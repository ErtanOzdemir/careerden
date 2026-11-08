import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RestartLoopGuard } from "./restart-loop-guard.js";

describe("RestartLoopGuard", () => {
  let directory: string;
  let statePath: string;
  let now: number;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "careerden-restarts-"));
    statePath = join(directory, "local-backend-restarts.json");
    now = Date.parse("2026-11-06T10:00:00.000Z");
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(directory, { recursive: true, force: true });
  });

  // A new guard per exit, like the new main process that each relaunch starts.
  function exitAfter(ms: number) {
    now += ms;
    return new RestartLoopGuard({ statePath, now: () => now }).recordUnexpectedExit();
  }

  it("relaunches twice and stops at the third exit within two minutes", async () => {
    await expect(exitAfter(0)).resolves.toEqual({ restart: true, recentExits: 1 });
    await expect(exitAfter(30_000)).resolves.toEqual({ restart: true, recentExits: 2 });
    await expect(exitAfter(30_000)).resolves.toEqual({ restart: false, recentExits: 3 });
  });

  it("forgets exits older than the window", async () => {
    await exitAfter(0);
    await exitAfter(10_000);

    // Two minutes after the first exit, but not after the second.
    await expect(exitAfter(115_000)).resolves.toEqual({ restart: true, recentExits: 2 });
  });

  it("starts over after a reset, such as a successful restore", async () => {
    await exitAfter(0);
    await exitAfter(1_000);
    await new RestartLoopGuard({ statePath }).reset();

    await expect(exitAfter(1_000)).resolves.toEqual({ restart: true, recentExits: 1 });
  });

  it("treats an unreadable history as empty", async () => {
    await writeFile(statePath, "{not json", "utf8");

    await expect(exitAfter(0)).resolves.toEqual({ restart: true, recentExits: 1 });
    expect(JSON.parse(await readFile(statePath, "utf8"))).toEqual({ exits: [now] });
  });

  it("stops relaunching when the history cannot be saved", async () => {
    const guard = new RestartLoopGuard({
      // A file cannot be written below another file.
      statePath: join(statePath, "nested.json"),
      now: () => now,
    });
    await writeFile(statePath, "", "utf8");
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(guard.recordUnexpectedExit()).resolves.toEqual({
      restart: false,
      recentExits: 1,
    });
  });
});
