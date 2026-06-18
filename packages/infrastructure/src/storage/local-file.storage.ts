import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { FileStorage, StoredFile, StoredFileContent, StoredFileInput } from "@link2cv/domain";

export class LocalFileStorage implements FileStorage {
  constructor(private readonly rootDir: string) {}

  async put(file: StoredFileInput): Promise<StoredFile> {
    const rootDir = resolve(this.rootDir);

    await mkdir(rootDir, { recursive: true });

    const id = `${randomUUID()}/${sanitizeFileName(file.fileName)}`;

    const path = join(rootDir, id);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, file.body);

    return {
      id,
      fileName: file.fileName,
      contentType: file.contentType,
      size: file.body.byteLength,
      url: `file://${path}`,
    };
  }

  async get(fileId: string): Promise<StoredFileContent> {
    const rootDir = resolve(this.rootDir);
    const path = this.resolveStoredPath(rootDir, fileId);
    const body = await readFile(path);

    return {
      id: fileId,
      fileName: path.split("/").at(-1) ?? fileId,
      contentType: contentTypeFromFileName(path),
      size: body.byteLength,
      body,
      url: `file://${path}`,
    };
  }

  async getSignedUrl(fileId: string): Promise<string> {
    const rootDir = resolve(this.rootDir);
    const path = this.resolveStoredPath(rootDir, fileId);

    await readFile(path);
    return `file://${path}`;
  }

  private resolveStoredPath(rootDir: string, fileId: string): string {
    if (fileId.includes("/")) {
      return join(rootDir, fileId);
    }

    return join(rootDir, `${fileId}.pdf`);
  }
}

function sanitizeFileName(fileName: string): string {
  const sanitized = fileName.replaceAll(/[^a-zA-Z0-9._-]/g, "-");
  return sanitized.length > 0 ? sanitized : "file";
}

function contentTypeFromFileName(fileName: string): string {
  if (fileName.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  return "application/pdf";
}
