import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LinkedInSessionManager, type LinkedInStorageState } from "./linkedin-session.manager.js";

const encryptionKey = Buffer.alloc(32, 3);
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("LinkedInSessionManager", () => {
  it("reports missing when no encrypted session exists", async () => {
    const dir = await createTemporaryDirectory();
    const manager = new LinkedInSessionManager(dir, encryptionKey);

    await expect(manager.getStatus()).resolves.toMatchObject({
      status: "missing",
    });
  });

  it("reports missing with a readable message when the login browser cannot open", async () => {
    const dir = await createTemporaryDirectory();
    const manager = new LinkedInSessionManager(dir, encryptionKey, {
      async launchBrowser() {
        throw new Error("GUI is unavailable");
      },
    });

    await expect(manager.startLogin()).resolves.toMatchObject({
      status: "missing",
      message: expect.stringContaining("GUI is unavailable"),
    });
  });

  it("encrypts a saved session with the installation key and owner-only permissions", async () => {
    const dir = await createTemporaryDirectory();
    const state = createStorageState();
    const manager = new LinkedInSessionManager(dir, encryptionKey, {
      launchBrowser: createBrowserLauncher(state),
    });

    await manager.startLogin();
    await expect(manager.saveLogin()).resolves.toMatchObject({ status: "connected" });
    await expect(manager.getStorageState()).resolves.toEqual(state);

    const sessionPath = join(dir, "linkedin-session.enc.json");
    const encrypted = await readFile(sessionPath, "utf8");

    expect(encrypted).not.toContain("linkedin-cookie");
    expect(JSON.parse(encrypted)).toMatchObject({
      algorithm: "aes-256-gcm",
      version: 2,
    });
    if (process.platform !== "win32") {
      expect((await stat(dir)).mode & 0o777).toBe(0o700);
      expect((await stat(sessionPath)).mode & 0o777).toBe(0o600);
    }
  });

  it("requires reconnecting when the installation key cannot decrypt the session", async () => {
    const dir = await createTemporaryDirectory();
    const manager = new LinkedInSessionManager(dir, encryptionKey, {
      launchBrowser: createBrowserLauncher(createStorageState()),
    });
    await manager.startLogin();
    await manager.saveLogin();

    await expect(
      new LinkedInSessionManager(dir, Buffer.alloc(32, 4)).getStatus(),
    ).resolves.toMatchObject({
      status: "expired",
      message: expect.stringContaining("reconnect"),
    });
  });

  it("requires reconnecting for a legacy static-secret session file", async () => {
    const dir = await createTemporaryDirectory();
    await writeFile(
      join(dir, "linkedin-session.enc.json"),
      JSON.stringify({ iv: "legacy", payload: "legacy", tag: "legacy" }),
      { mode: 0o600 },
    );

    await expect(new LinkedInSessionManager(dir, encryptionKey).getStatus()).resolves.toMatchObject(
      {
        status: "expired",
        message: expect.stringContaining("reconnect"),
      },
    );
  });
});

function createBrowserLauncher(state: LinkedInStorageState) {
  return vi.fn(async () => {
    const page = {
      goto: vi.fn(async () => undefined),
    };
    const context = {
      newPage: vi.fn(async () => page),
      storageState: vi.fn(async () => state),
    };

    return {
      close: vi.fn(async () => undefined),
      newContext: vi.fn(async () => context),
    } as never;
  });
}

function createStorageState(): LinkedInStorageState {
  return {
    cookies: [
      {
        domain: ".linkedin.com",
        expires: Math.floor(Date.now() / 1000) + 3600,
        httpOnly: true,
        name: "li_at",
        path: "/",
        sameSite: "Lax",
        secure: true,
        value: "linkedin-cookie",
      },
    ],
    origins: [],
  };
}

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "careerden-linkedin-session-"));
  temporaryDirectories.push(directory);
  return directory;
}
