import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DesktopLogger } from "./desktop-logger.js";
import { logSettingsIpcChannels, registerLogSettingsIpc } from "./log-settings-ipc.js";
import { LogSettingsStore } from "./log-settings-store.js";

describe("registerLogSettingsIpc", () => {
  let directory: string;
  let store: LogSettingsStore;
  let logger: DesktopLogger;
  let handlers: Map<string, (event: unknown, ...args: unknown[]) => unknown>;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "careerden-log-settings-"));
    store = new LogSettingsStore(join(directory, "log-settings.json"));
    logger = new DesktopLogger({ directory: join(directory, "logs") });
    handlers = new Map();
    registerLogSettingsIpc(
      {
        register: (channel, handler) => {
          handlers.set(channel, handler);
          return undefined;
        },
      },
      store,
      logger,
    );
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("defaults to info", async () => {
    await expect(store.readLevel()).resolves.toBe("info");
    expect(handlers.get(logSettingsIpcChannels.getLevel)?.({})).toBe("info");
  });

  it("persists and applies debug logging", async () => {
    await handlers.get(logSettingsIpcChannels.setLevel)?.({}, "debug");

    expect(logger.level).toBe("debug");
    expect(handlers.get(logSettingsIpcChannels.getLevel)?.({})).toBe("debug");
    await expect(store.readLevel()).resolves.toBe("debug");
    expect(JSON.parse(await readFile(join(directory, "log-settings.json"), "utf8"))).toEqual({
      level: "debug",
    });
  });

  it("rejects levels outside the selectable set", async () => {
    await expect(
      Promise.resolve().then(() => handlers.get(logSettingsIpcChannels.setLevel)?.({}, "error")),
    ).rejects.toThrow();
    expect(logger.level).toBe("info");
  });

  it("treats an unreadable settings file as info", async () => {
    await writeFile(join(directory, "log-settings.json"), "not json", "utf8");

    await expect(store.readLevel()).resolves.toBe("info");
  });
});
