import { z } from "zod";
import type { DesktopLogger } from "./desktop-logger.js";
import { selectableLogLevels, type LogSettingsStore } from "./log-settings-store.js";

export const logSettingsIpcChannels = {
  getLevel: "desktop-log-get-level",
  setLevel: "desktop-log-set-level",
} as const;

const levelSchema = z.enum(selectableLogLevels);

interface IpcRegistrar {
  register(channel: string, handler: (event: unknown, ...args: unknown[]) => unknown): unknown;
}

// Lets the renderer read and change only the log level; it never sees log contents or paths.
export function registerLogSettingsIpc(
  registry: IpcRegistrar,
  store: LogSettingsStore,
  logger: Pick<DesktopLogger, "info" | "level" | "setLevel">,
): void {
  registry.register(logSettingsIpcChannels.getLevel, () =>
    logger.level === "debug" ? "debug" : "info",
  );
  registry.register(logSettingsIpcChannels.setLevel, async (_event, input) => {
    const level = levelSchema.parse(input);
    await store.writeLevel(level);
    logger.setLevel(level);
    logger.info("logging.level_changed", { level });
    return level;
  });
}
