import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { FileStorage, StoredFile, StoredFileContent, StoredFileInput } from "@link2cv/domain";

export class LocalFileStorage implements FileStorage {
  constructor(private readonly rootDir: string) {}

  async put(file: StoredFileInput): Promise<StoredFile> {
    const rootDir = resolve(this.rootDir);

    await mkdir(rootDir, { recursive: true });

    const id = file.key ?? `${randomUUID()}/${sanitizeFileName(file.fileName)}`;

    const path = this.resolveStoredPath(rootDir, id);
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

  async delete(fileId: string): Promise<void> {
    const rootDir = resolve(this.rootDir);
    const path = this.resolveStoredPath(rootDir, fileId);

    await rm(path, { force: true });
  }

  private resolveStoredPath(rootDir: string, fileId: string): string {
    const path = fileId.includes("/") ? join(rootDir, fileId) : join(rootDir, `${fileId}.pdf`);
    const relativePath = relative(rootDir, path);

    if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
      throw new Error("Invalid file ID");
    }

    return path;
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
