import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { readFile, rename, rm, stat } from "node:fs/promises";
import { finished } from "node:stream/promises";
import { Zip, ZipDeflate, ZipPassThrough, strToU8, unzipSync, type UnzipFileInfo } from "fflate";

export class ZipArchiveError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ZipArchiveError";
  }
}

export interface ZipArchiveWriter {
  // Deflates text such as JSON, which compresses well.
  addText(name: string, text: string): void;
  // Streams a file from disk without recompressing it; stored files are mostly PDFs and images.
  addFile(name: string, sourcePath: string): Promise<void>;
}

// Writes a zip next to `outputPath` and moves it into place only once it is complete, so a
// failed or interrupted export never leaves a truncated archive under the chosen name.
export async function writeZipArchive(
  outputPath: string,
  build: (writer: ZipArchiveWriter) => Promise<void>,
): Promise<void> {
  const partialPath = `${outputPath}.${randomUUID()}.partial`;
  const output = createWriteStream(partialPath, { flags: "wx" });
  let failure: Error | undefined;
  // A write error can surface while `build` is still running, before anything awaits the stream.
  output.on("error", (error) => {
    failure ??= error;
  });
  const zip = new Zip((error, chunk, final) => {
    if (error) {
      failure = error;
      output.destroy(error);
      return;
    }
    output.write(chunk);
    if (final) output.end();
  });

  try {
    const names = new Set<string>();
    const add = <T extends ZipDeflate | ZipPassThrough>(entry: T): T => {
      assertSafeEntryName(entry.filename);
      if (names.has(entry.filename)) {
        throw new ZipArchiveError(`Duplicate archive entry: ${entry.filename}`);
      }
      names.add(entry.filename);
      zip.add(entry);
      return entry;
    };

    await build({
      addText: (name, text) => {
        add(new ZipDeflate(name, { level: 6 })).push(strToU8(text), true);
      },
      addFile: async (name, sourcePath) => {
        const entry = add(new ZipPassThrough(name));
        for await (const chunk of createReadStream(sourcePath)) {
          entry.push(chunk as Buffer);
        }
        entry.push(new Uint8Array(0), true);
      },
    });
    zip.end();
    await finished(output);
    if (failure) throw failure;
    await rename(partialPath, outputPath);
  } catch (error) {
    zip.terminate();
    output.destroy();
    // The file opens asynchronously; wait for the stream to close so the partial file exists
    // and is released before it is removed.
    await finished(output).catch(() => undefined);
    await rm(partialPath, { force: true });
    throw error;
  }
}

export interface ZipArchiveLimits {
  maxArchiveBytes: number;
  maxUncompressedBytes: number;
  maxEntries: number;
}

// Reads every file entry of a zip into memory after checking the archive against the limits,
// using the sizes the archive declares before anything is decompressed.
export async function readZipArchive(
  archivePath: string,
  limits: ZipArchiveLimits,
): Promise<Map<string, Uint8Array>> {
  const { size } = await stat(archivePath);
  if (size > limits.maxArchiveBytes) {
    throw new ZipArchiveError("The archive is larger than the supported maximum.");
  }

  const data = await readFile(archivePath);
  let entryCount = 0;
  let uncompressedBytes = 0;
  const accept = (file: UnzipFileInfo): boolean => {
    // Directory entries carry no data; their files are listed with full paths.
    if (file.name.endsWith("/")) return false;
    assertSafeEntryName(file.name);
    entryCount += 1;
    uncompressedBytes += file.originalSize;
    if (entryCount > limits.maxEntries) {
      throw new ZipArchiveError("The archive contains too many files.");
    }
    if (uncompressedBytes > limits.maxUncompressedBytes) {
      throw new ZipArchiveError("The archive expands beyond the supported maximum size.");
    }
    return true;
  };

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(data, { filter: accept });
  } catch (error) {
    if (error instanceof ZipArchiveError) throw error;
    throw new ZipArchiveError("The file is not a readable zip archive.", { cause: error });
  }

  // Duplicate names would collapse into one key; the counted entries reveal them.
  if (Object.keys(entries).length !== entryCount) {
    throw new ZipArchiveError("The archive contains duplicate entries.");
  }
  return new Map(Object.entries(entries));
}

// Entry names become paths on disk when files are restored, so only plain relative paths pass.
export function assertSafeEntryName(name: string): void {
  const segments = name.split("/");
  if (
    name.length === 0 ||
    name.length > 1_024 ||
    name.includes("\\") ||
    name.includes("\0") ||
    /^[A-Za-z]:/.test(name) ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new ZipArchiveError(`Unsafe archive entry name: ${name.slice(0, 200)}`);
  }
}
