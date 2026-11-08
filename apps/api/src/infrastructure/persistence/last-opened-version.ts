import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Kept in the data folder, next to `pglite` and `files`, so it travels with the data it
// describes when the folder is backed up or restored.
export const lastOpenedVersionFile = "last-opened-version.json";

export interface LastOpenedVersion {
  version: string;
  openedAt: string;
}

// The app version that last opened and migrated the data, or undefined when none was recorded
// or the record cannot be read.
export async function readLastOpenedVersion(
  dataDir: string,
): Promise<LastOpenedVersion | undefined> {
  let contents: string;
  try {
    contents = await readFile(join(dataDir, lastOpenedVersionFile), "utf8");
  } catch {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(contents);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "version" in parsed &&
      typeof parsed.version === "string" &&
      parsed.version.length > 0
    ) {
      const openedAt = "openedAt" in parsed ? parsed.openedAt : undefined;
      return {
        version: parsed.version,
        openedAt: typeof openedAt === "string" ? openedAt : "",
      };
    }
  } catch {
    // An unreadable record counts as no record.
  }
  return undefined;
}

// Written through a temporary file so a crash never leaves a half-written record.
export async function writeLastOpenedVersion(
  dataDir: string,
  version: string,
  now: Date = new Date(),
): Promise<void> {
  const path = join(dataDir, lastOpenedVersionFile);
  const record: LastOpenedVersion = { version, openedAt: now.toISOString() };
  await writeFile(`${path}.tmp`, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  await rename(`${path}.tmp`, path);
}
