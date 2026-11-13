import { readdirSync } from "node:fs";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LocalApiRuntime } from "./create-local-api-runtime.js";
import { createLocalApiRuntime } from "./create-local-api-runtime.js";
import { localSessionTokenHeader } from "./local-session.middleware.js";

// Each directory holds a Careerden Unplugged database as a released version left it, built by
// scripts/generate-pglite-fixture.mjs. See docs/development.md for adding one per release.
const fixturesDirectory = fileURLToPath(new URL("../../test/fixtures/pglite/", import.meta.url));
const fixtureVersions = readdirSync(fixturesDirectory, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^v\d+\.\d+\.\d+$/.test(entry.name))
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right, "en", { numeric: true }));

const sessionToken = "test-session-token";

interface FixtureManifest {
  version: string;
  migrations: string[];
  expectations: {
    profileId: string;
    profileFullName: string;
    activeApplications: Record<string, string>;
    archivedApplications: Record<string, string>;
    applicationsWithDocumentContent: string[];
    documents: Array<{ id: string; jobApplicationId: string; kind: string; fileId: string }>;
    followUpIds: string[];
    notificationIds: string[];
  };
}

interface JobApplicationPage {
  items: Array<{ id: string; status: string }>;
  totalItems: number;
}

interface JobApplicationDetail {
  id: string;
  status: string;
  documentContent: unknown;
  documents: Array<{ id: string; kind: string; fileId: string }>;
  followUps: Array<{ id: string }>;
}

it("has an upgrade fixture for at least one released version", () => {
  expect(fixtureVersions.length).toBeGreaterThan(0);
});

// Restores every fixture into a fresh data directory and starts the local runtime on it, which
// runs the current migrations exactly as an updated app does on first launch, then reads the
// data back through the HTTP routes and the real repositories behind them.
describe.each(fixtureVersions)(
  "upgrading a %s Unplugged database",
  { timeout: 60_000 },
  (version) => {
    const fixtureDirectory = join(fixturesDirectory, version);
    let dataDir: string;
    let manifest: FixtureManifest;
    const runtimes: LocalApiRuntime[] = [];
    const servers: Server[] = [];

    beforeEach(async () => {
      dataDir = join(await mkdtemp(join(tmpdir(), "careerden-upgrade-")), "data");
      manifest = JSON.parse(await readFile(join(fixtureDirectory, "fixture.json"), "utf8"));
      await restoreFixture(fixtureDirectory, dataDir);
    });

    afterEach(async () => {
      await Promise.all(
        servers
          .splice(0)
          .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
      );
      await Promise.all(runtimes.splice(0).map((runtime) => runtime.close()));
      await rm(join(dataDir, ".."), { recursive: true, force: true });
    });

    async function start() {
      const runtime = await createLocalApiRuntime({
        dataDir,
        sessionToken,
        pdfRenderer: { htmlToPdf: async () => Buffer.from("%PDF-test") },
        aiProviderSelection: { current: async () => null },
        backgroundPollIntervalMs: 50,
      });
      runtimes.push(runtime);
      const server = runtime.app.listen(0, "127.0.0.1");
      servers.push(server);
      await new Promise<void>((resolve) => server.once("listening", () => resolve()));
      const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const request = (path: string) =>
        fetch(`${baseUrl}${path}`, { headers: { [localSessionTokenHeader]: sessionToken } });

      return {
        runtime,
        request,
        json: async <T>(path: string): Promise<T> => {
          const response = await request(path);
          expect(response.status, path).toBe(200);
          return (await response.json()) as T;
        },
      };
    }

    it("applies the current migrations on top of the release's history", async () => {
      const { runtime } = await start();

      const applied = await runtime.db("knex_migrations").orderBy("id").pluck("name");

      expect(applied.slice(0, manifest.migrations.length)).toEqual(manifest.migrations);
    });

    it("reads the profile and lists active and archived applications", async () => {
      const { json } = await start();
      const { expectations } = manifest;

      const profile = await json<{ id: string; fullName: string }>("/profiles/me");
      const active = await json<JobApplicationPage>(
        `/job-applications?profileId=${expectations.profileId}&pageSize=100`,
      );
      const archived = await json<JobApplicationPage>(
        `/job-applications?profileId=${expectations.profileId}&archiveState=archived&pageSize=100`,
      );

      expect(profile).toMatchObject({
        id: expectations.profileId,
        fullName: expectations.profileFullName,
      });
      expect(statusById(active)).toEqual(expectations.activeApplications);
      expect(statusById(archived)).toEqual(expectations.archivedApplications);
    });

    it("reads application details, drafts, follow-ups, and notifications", async () => {
      const { json } = await start();
      const { expectations } = manifest;
      const applicationIds = [
        ...Object.keys(expectations.activeApplications),
        ...Object.keys(expectations.archivedApplications),
      ];

      const details = await Promise.all(
        applicationIds.map((id) => json<JobApplicationDetail>(`/job-applications/${id}`)),
      );
      const notifications = await json<Array<{ id: string }>>("/notifications");

      expect(details.filter((detail) => detail.documentContent).map((detail) => detail.id)).toEqual(
        expect.arrayContaining(expectations.applicationsWithDocumentContent),
      );
      expect(details.flatMap((detail) => detail.followUps.map((followUp) => followUp.id))).toEqual(
        expect.arrayContaining(expectations.followUpIds),
      );
      expect(details.flatMap((detail) => detail.documents)).toEqual(
        expect.arrayContaining(
          expectations.documents.map(({ id, kind, fileId }) =>
            expect.objectContaining({ id, kind, fileId }),
          ),
        ),
      );
      expect(notifications.map((notification) => notification.id)).toEqual(
        expect.arrayContaining(expectations.notificationIds),
      );
    });

    it("downloads every generated document", async () => {
      const { json, request } = await start();

      for (const document of manifest.expectations.documents) {
        const { url } = await json<{ url: string }>(
          `/job-applications/${document.jobApplicationId}/documents/${document.id}/download`,
        );
        // The desktop shell strips the /api prefix before proxying to the local backend.
        const download = await request(url.replace(/^\/api/, ""));

        expect(download.status, document.fileId).toBe(200);
        expect(Buffer.from(await download.arrayBuffer())).toEqual(
          await readFile(join(fixtureDirectory, "files", ...document.fileId.split("/"))),
        );
      }
    });
  },
);

// Lays the fixture out the way the local runtime finds its data directory: the dump restored into
// an on-disk PGlite cluster under pglite/ and the stored files under files/.
async function restoreFixture(fixtureDirectory: string, dataDir: string): Promise<void> {
  await cp(join(fixtureDirectory, "files"), join(dataDir, "files"), { recursive: true });
  const pglite = new PGlite(join(dataDir, "pglite"));
  try {
    await pglite.exec(await readFile(join(fixtureDirectory, "database.sql"), "utf8"));
  } finally {
    await pglite.close();
  }
}

function statusById(page: JobApplicationPage): Record<string, string> {
  expect(page.totalItems).toBe(page.items.length);
  return Object.fromEntries(page.items.map((item) => [item.id, item.status]));
}
