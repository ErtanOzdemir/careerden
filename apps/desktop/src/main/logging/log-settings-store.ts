import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

// The log levels a user can pick in settings.
export const selectableLogLevels = ["info", "debug"] as const;
export type SelectableLogLevel = (typeof selectableLogLevels)[number];

// Persists the log level in a small JSON file in userData. A missing or unreadable file means the
// default `info` level.
export class LogSettingsStore {
  constructor(private readonly path: string) {}

  async readLevel(): Promise<SelectableLogLevel> {
    try {
      const parsed = JSON.parse(await readFile(this.path, "utf8")) as { level?: unknown };
      return parsed.level === "debug" ? "debug" : "info";
    } catch {
      return "info";
    }
  }

  async writeLevel(level: SelectableLogLevel): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, `${JSON.stringify({ level }, null, 2)}\n`, "utf8");
  }
}
