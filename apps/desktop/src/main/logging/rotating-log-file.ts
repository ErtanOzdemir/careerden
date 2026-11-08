import { appendFileSync, mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

export interface RotatingLogFileOptions {
  directory: string;
  // For example "careerden.log"; rotated files become "careerden.1.log", "careerden.2.log", ...
  fileName: string;
  maxFileBytes: number;
  // Total number of files kept, including the active one.
  maxFiles: number;
}

// Appends lines to a log file and rotates it before a write would exceed the size limit. Writes
// are synchronous so ordering holds and the last lines reach disk before the app exits.
export class RotatingLogFile {
  private size: number | undefined;

  constructor(private readonly options: RotatingLogFileOptions) {
    if (options.maxFileBytes < 1) throw new Error("maxFileBytes must be positive");
    if (options.maxFiles < 1) throw new Error("maxFiles must be positive");
  }

  get activePath(): string {
    return this.pathAt(0);
  }

  // Every file this writer may own, newest first.
  paths(): string[] {
    return Array.from({ length: this.options.maxFiles }, (_value, index) => this.pathAt(index));
  }

  append(line: string): void {
    const data = fitToLimit(`${line}\n`, this.options.maxFileBytes);
    const bytes = Buffer.byteLength(data);
    this.size ??= this.readActiveSize();

    if (this.size > 0 && this.size + bytes > this.options.maxFileBytes) {
      this.rotate();
    }

    appendFileSync(this.activePath, data, { encoding: "utf8", mode: 0o600 });
    this.size += bytes;
  }

  private rotate(): void {
    const paths = this.paths();
    rmSync(paths[paths.length - 1]!, { force: true });
    for (let index = paths.length - 2; index >= 0; index -= 1) {
      try {
        renameSync(paths[index]!, paths[index + 1]!);
      } catch (error) {
        if (!isMissingFile(error)) throw error;
      }
    }
    this.size = 0;
  }

  private readActiveSize(): number {
    mkdirSync(this.options.directory, { recursive: true });
    try {
      return statSync(this.activePath).size;
    } catch (error) {
      if (isMissingFile(error)) return 0;
      throw error;
    }
  }

  private pathAt(index: number): string {
    const { directory, fileName } = this.options;
    if (index === 0) return join(directory, fileName);
    const extensionStart = fileName.lastIndexOf(".");
    const rotatedName =
      extensionStart > 0
        ? `${fileName.slice(0, extensionStart)}.${index}${fileName.slice(extensionStart)}`
        : `${fileName}.${index}`;
    return join(directory, rotatedName);
  }
}

function fitToLimit(data: string, maxBytes: number): string {
  if (Buffer.byteLength(data) <= maxBytes) return data;
  // Cut on a character boundary and keep the trailing newline.
  let line = data.slice(0, -1);
  while (line.length > 0 && Buffer.byteLength(`${line}\n`) > maxBytes) {
    line = line.slice(0, Math.max(0, Math.floor(line.length * 0.9)));
  }
  return `${line}\n`;
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
