import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import type { FileStorage, StoredFile, StoredFileContent, StoredFileInput } from "@careerden/domain";

export interface LocalFileStorageOptions {
  rootDir: string;
  // Secret for signing download URLs; generate a fresh one per process.
  signingKey: string;
  // Path the signed URLs point at, served by a route that calls verifySignedUrl.
  urlPathPrefix: string;
  urlTtlMs?: number;
  now?: () => Date;
}

export interface SignedFileUrlParams {
  fileId: string;
  expires: string;
  signature: string;
}

interface StoredFileMetadata {
  fileName: string;
  contentType: string;
  metadata?: Record<string, string>;
}

const metadataSuffix = ".meta.json";

// Keeps files on the local disk for the local edition, mirroring the S3 adapter's id scheme.
export class LocalFileStorage implements FileStorage {
  private readonly rootDir: string;
  private readonly urlTtlMs: number;
  private readonly now: () => Date;

  constructor(private readonly options: LocalFileStorageOptions) {
    this.rootDir = resolve(options.rootDir);
    this.urlTtlMs = options.urlTtlMs ?? 15 * 60 * 1000;
    this.now = options.now ?? (() => new Date());
  }

  async put(file: StoredFileInput): Promise<StoredFile> {
    const id = file.key ?? `${randomUUID()}/${sanitizeFileName(file.fileName)}`;
    const path = this.resolvePath(id);
    const metadata: StoredFileMetadata = {
      fileName: file.fileName,
      contentType: file.contentType,
      ...(file.metadata ? { metadata: file.metadata } : {}),
    };

    await mkdir(dirname(path), { recursive: true });
    await writeAtomically(path, file.body);
    await writeAtomically(`${path}${metadataSuffix}`, JSON.stringify(metadata));

    return {
      id,
      fileName: file.fileName,
      contentType: file.contentType,
      size: file.body.byteLength,
    };
  }

  async get(fileId: string): Promise<StoredFileContent> {
    const path = this.resolvePath(fileId);
    const [body, metadata] = await Promise.all([readFile(path), this.readMetadata(path)]);

    return {
      id: fileId,
      fileName: fileId.split("/").at(-1) ?? fileId,
      contentType: metadata?.contentType ?? contentTypeFromFileName(fileId),
      size: body.byteLength,
      body,
    };
  }

  async getSignedUrl(fileId: string): Promise<string> {
    await stat(this.resolvePath(fileId));
    const expires = String(this.now().getTime() + this.urlTtlMs);
    const query = new URLSearchParams({ expires, signature: this.sign(fileId, expires) });

    return `${this.options.urlPathPrefix}/${encodeURIComponent(fileId)}?${query.toString()}`;
  }

  verifySignedUrl(params: SignedFileUrlParams): boolean {
    const expiresAt = Number(params.expires);
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= this.now().getTime()) return false;

    const expected = Buffer.from(this.sign(params.fileId, params.expires));
    const actual = Buffer.from(params.signature);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  async delete(fileId: string): Promise<void> {
    const path = this.resolvePath(fileId);

    await Promise.all([rm(path, { force: true }), rm(`${path}${metadataSuffix}`, { force: true })]);
  }

  private resolvePath(fileId: string): string {
    const path = resolve(this.rootDir, fileId);
    const relativePath = relative(this.rootDir, path);

    if (
      !fileId ||
      fileId.endsWith(metadataSuffix) ||
      relativePath === "" ||
      relativePath.startsWith("..") ||
      isAbsolute(relativePath)
    ) {
      throw new Error(`Invalid file id: ${fileId}`);
    }

    return path;
  }

  private async readMetadata(path: string): Promise<StoredFileMetadata | null> {
    try {
      return JSON.parse(await readFile(`${path}${metadataSuffix}`, "utf8")) as StoredFileMetadata;
    } catch {
      return null;
    }
  }

  private sign(fileId: string, expires: string): string {
    return createHmac("sha256", this.options.signingKey)
      .update(`${fileId}\n${expires}`)
      .digest("base64url");
  }
}

async function writeAtomically(path: string, data: Buffer | string): Promise<void> {
  const temporaryPath = `${path}.${randomUUID()}.tmp`;

  try {
    await writeFile(temporaryPath, data);
    await rename(temporaryPath, path);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
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
