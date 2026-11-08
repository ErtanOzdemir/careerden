export const logLevels = ["debug", "info", "warn", "error"] as const;

export type LogLevel = (typeof logLevels)[number];

export type LogFieldValue = string | number | boolean | null;

// One log record. Fields carry metadata such as status codes, durations, and identifiers;
// never profile content, job posting text, prompts, model output, or file contents.
export interface StructuredLogEntry {
  level: LogLevel;
  event: string;
  fields?: Record<string, LogFieldValue>;
}

export type StructuredLogger = (entry: StructuredLogEntry) => void;

export function isLogLevel(value: unknown): value is LogLevel {
  return logLevels.some((level) => level === value);
}

// Writes to the console, for runtimes that have no log file of their own.
export const consoleStructuredLogger: StructuredLogger = ({ event, fields = {}, level }) => {
  if (level === "error") console.error(event, fields);
  else if (level === "warn") console.warn(event, fields);
  else console.info(event, fields);
};
