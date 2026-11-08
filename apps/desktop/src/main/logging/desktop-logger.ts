import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  describeErrorForLog,
  logLevels,
  redactKnownSecrets,
  redactSensitiveLogText,
} from "@careerden/infrastructure/logging";
import type {
  LogFieldValue,
  LogLevel,
  StructuredLogEntry,
  StructuredLogger,
} from "@careerden/infrastructure/logging";
import { redactHomeDir } from "../startup-recovery/startup-diagnostics.js";
import { RotatingLogFile } from "./rotating-log-file.js";

export const desktopLogFileName = "careerden.log";
export const defaultDesktopLogMaxFileBytes = 5 * 1024 * 1024;
export const defaultDesktopLogMaxFiles = 5;

// The process a log line came from. Utility processes post their entries to the main process,
// which is the only writer of the log file.
export type DesktopLogSource = "main" | "local-backend" | "scraper";

export interface DesktopLoggerOptions {
  directory: string;
  level?: LogLevel;
  maxFileBytes?: number;
  maxFiles?: number;
  now?: () => Date;
  // Replaced with "~" in every value, so paths do not carry the user's account name.
  homeDir?: string;
  // Also print entries to the console, for development.
  mirrorToConsole?: boolean;
}

const maximumFieldCount = 32;
const maximumFieldValueLength = 2_000;
const fieldKeyPattern = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;
const eventPattern = /^[a-z][a-z0-9_.-]{0,99}$/;
const reservedKeys = new Set(["time", "level", "process", "event"]);
// Field names that suggest secrets or personal content are never written, whatever their value.
const sensitiveFieldKeyPattern =
  /api.?key|token|secret|password|passcode|authorization|cookie|credential|prompt|profile|content|html|body|output|text|description|resume|letter/i;

export function resolveDesktopLogsDirectory(userDataPath: string): string {
  return join(userDataPath, "logs");
}

// Writes redacted JSON lines for every desktop process to `userData/logs/careerden.log`, rotating
// at 5 MB and keeping at most five files. Never throws: logging must not break the app.
export class DesktopLogger {
  readonly directory: string;
  private readonly file: RotatingLogFile;
  private readonly secrets = new Set<string>();
  private currentLevel: LogLevel;

  constructor(private readonly options: DesktopLoggerOptions) {
    this.directory = options.directory;
    this.currentLevel = options.level ?? "info";
    this.file = new RotatingLogFile({
      directory: options.directory,
      fileName: desktopLogFileName,
      maxFileBytes: options.maxFileBytes ?? defaultDesktopLogMaxFileBytes,
      maxFiles: options.maxFiles ?? defaultDesktopLogMaxFiles,
    });
  }

  get filePath(): string {
    return this.file.activePath;
  }

  get level(): LogLevel {
    return this.currentLevel;
  }

  setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  // Values the main process holds, such as the session token and API keys, are removed from
  // every later line, including partial echoes.
  registerSecret(secret: string): void {
    // Shorter values would redact ordinary words.
    if (secret.length >= 8) this.secrets.add(secret);
  }

  // A logger bound to one process, for components and utility process forwarding.
  forSource(source: DesktopLogSource): StructuredLogger {
    return (entry) => this.write(source, entry);
  }

  debug(event: string, fields?: Record<string, LogFieldValue>): void {
    this.write("main", { level: "debug", event, ...(fields ? { fields } : {}) });
  }

  info(event: string, fields?: Record<string, LogFieldValue>): void {
    this.write("main", { level: "info", event, ...(fields ? { fields } : {}) });
  }

  warn(event: string, fields?: Record<string, LogFieldValue>): void {
    this.write("main", { level: "warn", event, ...(fields ? { fields } : {}) });
  }

  error(event: string, fields?: Record<string, LogFieldValue>): void {
    this.write("main", { level: "error", event, ...(fields ? { fields } : {}) });
  }

  // Logs an error's name, code, status, and redacted message at error level.
  exception(event: string, error: unknown, fields: Record<string, LogFieldValue> = {}): void {
    this.error(event, { ...fields, ...describeErrorForLog(error) });
  }

  write(source: DesktopLogSource, entry: StructuredLogEntry): void {
    if (logLevels.indexOf(entry.level) < logLevels.indexOf(this.currentLevel)) return;

    try {
      const line = JSON.stringify({
        time: (this.options.now?.() ?? new Date()).toISOString(),
        level: entry.level,
        process: source,
        event: eventPattern.test(entry.event) ? entry.event : "invalid_event",
        ...this.sanitizeFields(entry.fields),
      });
      this.file.append(line);
      if (this.options.mirrorToConsole) mirror(entry.level, line);
    } catch (error) {
      if (this.options.mirrorToConsole) console.error("Could not write the desktop log", error);
    }
  }

  // The last lines across the active and rotated files, oldest first. Lines are already redacted.
  async readTail(lineCount: number): Promise<string[]> {
    const lines: string[] = [];
    for (const path of this.file.paths()) {
      if (lines.length >= lineCount) break;
      let content: string;
      try {
        content = await readFile(path, "utf8");
      } catch {
        continue;
      }
      const fileLines = content.split("\n").filter((line) => line.length > 0);
      lines.unshift(...fileLines.slice(-(lineCount - lines.length)));
    }
    return lines;
  }

  private sanitizeFields(
    fields: Record<string, LogFieldValue> | undefined,
  ): Record<string, LogFieldValue> {
    const sanitized: Record<string, LogFieldValue> = {};
    for (const [key, value] of Object.entries(fields ?? {}).slice(0, maximumFieldCount)) {
      if (!fieldKeyPattern.test(key) || reservedKeys.has(key)) continue;
      if (sensitiveFieldKeyPattern.test(key)) {
        sanitized[key] = "[REDACTED]";
      } else if (typeof value === "string") {
        sanitized[key] = this.redact(value);
      } else if (typeof value === "number") {
        sanitized[key] = Number.isFinite(value) ? value : null;
      } else if (typeof value === "boolean" || value === null) {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  private redact(value: string): string {
    const redacted = redactSensitiveLogText(
      redactHomeDir(redactKnownSecrets(value, this.secrets), this.options.homeDir ?? ""),
    );
    return redacted.length > maximumFieldValueLength
      ? `${redacted.slice(0, maximumFieldValueLength)}...[TRUNCATED]`
      : redacted;
  }
}

function mirror(level: LogLevel, line: string): void {
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
