import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { FileStorage, StoredFile, StoredFileInput } from "@link2cv/domain";

export class LocalFileStorage implements FileStorage {
  constructor(private readonly rootDir: string) {}

  async put(file: StoredFileInput): Promise<StoredFile> {
    const rootDir = resolve(this.rootDir);

    await mkdir(rootDir, { recursive: true });

    const id = randomUUID();
    const fileName = `${id}.pdf`;

    await writeFile(join(rootDir, fileName), file.body);

    return {
      id,
      fileName: file.fileName,
      contentType: file.contentType,
      size: file.body.byteLength,
      url: `file://${join(rootDir, fileName)}`
    };
  }

  async getSignedUrl(fileId: string): Promise<string> {
    const fileName = `${fileId}.pdf`;
    const rootDir = resolve(this.rootDir);

    await readFile(join(rootDir, fileName));
    return `file://${join(rootDir, fileName)}`;
  }
}
