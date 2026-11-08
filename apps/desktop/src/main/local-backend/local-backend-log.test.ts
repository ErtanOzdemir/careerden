import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLocalBackendLog } from "./local-backend-log.js";

describe("createLocalBackendLog", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "careerden-log-"));
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  it("appends timestamped lines in order, creating the log folder", async () => {
    const logFile = join(root, "logs", "local-backend.log");
    const log = createLocalBackendLog(logFile, () => new Date("2026-11-07T10:00:00.000Z"));

    log("Created local data snapshot before-migration-2026-11-07T10-00-00Z");
    log("Removed old local data snapshot before-migration-2026-11-01T10-00-00Z");

    await vi.waitFor(async () =>
      expect(await readFile(logFile, "utf8").catch(() => "")).toBe(
        "2026-11-07T10:00:00.000Z Created local data snapshot before-migration-2026-11-07T10-00-00Z\n" +
          "2026-11-07T10:00:00.000Z Removed old local data snapshot before-migration-2026-11-01T10-00-00Z\n",
      ),
    );
  });

  it("never throws when the log cannot be written", async () => {
    // A file where the log folder should be makes every write fail.
    await writeFile(join(root, "logs"), "");
    const log = createLocalBackendLog(join(root, "logs", "local-backend.log"));

    expect(() => log("Created local data snapshot")).not.toThrow();
    await vi.waitFor(() => expect(console.error).toHaveBeenCalled());
  });
});
