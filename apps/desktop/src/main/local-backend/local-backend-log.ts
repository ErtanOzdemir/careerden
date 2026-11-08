import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

// Appends timestamped lines about the local data, such as snapshots taken before migrations, to
// a log file the user can find next to their data. Writes are queued so lines stay in order, and
// a failure to log never fails the launch.
export function createLocalBackendLog(
  logFile: string,
  now: () => Date = () => new Date(),
): (message: string) => void {
  let pending = Promise.resolve();
  return (message) => {
    const line = `${now().toISOString()} ${message}\n`;
    console.info(message);
    pending = pending
      .then(() => mkdir(dirname(logFile), { recursive: true }))
      .then(() => appendFile(logFile, line, "utf8"))
      .catch((error: unknown) => {
        console.error("Could not write the local backend log", error);
      });
  };
}
