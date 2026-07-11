import {
  DeleteObjectCommand,
  CreateBucketCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import type { FileStorage, StoredFile, StoredFileContent, StoredFileInput } from "@link2cv/domain";

export interface RustFsStorageOptions {
  accessKeyId: string;
  bucket: string;
  endpoint: string;
  forcePathStyle?: boolean;
  region: string;
  secretAccessKey: string;
}

export class RustFsStorage implements FileStorage {
  private readonly client: S3Client;

  constructor(private readonly options: RustFsStorageOptions) {
    this.client = new S3Client({
      endpoint: options.endpoint,
      forcePathStyle: options.forcePathStyle ?? true,
      region: options.region,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    });
  }

  async put(file: StoredFileInput): Promise<StoredFile> {
    const id = file.key ?? `${randomUUID()}/${sanitizeFileName(file.fileName)}`;

    await this.putObject(id, file);

    return {
      id,
      fileName: file.fileName,
      contentType: file.contentType,
      size: file.body.byteLength,
    };
  }

  async get(fileId: string): Promise<StoredFileContent> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.options.bucket,
        Key: fileId,
      }),
    );
    const body = await streamToBuffer(response.Body as Readable);

    return {
      id: fileId,
      fileName: fileId.split("/").at(-1) ?? fileId,
      contentType: response.ContentType ?? contentTypeFromFileName(fileId),
      size: body.byteLength,
      body,
    };
  }

  async getSignedUrl(fileId: string): Promise<string> {
    await this.client.send(
      new HeadObjectCommand({
        Bucket: this.options.bucket,
        Key: fileId,
      }),
    );

    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.options.bucket,
        Key: fileId,
      }),
      { expiresIn: 60 * 15 },
    );
  }

  async delete(fileId: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.options.bucket,
        Key: fileId,
      }),
    );
  }

  private async putObject(id: string, file: StoredFileInput): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.options.bucket,
          Key: id,
          Body: file.body,
          ContentType: file.contentType,
          Metadata: file.metadata,
        }),
      );
    } catch (error) {
      if (!isMissingBucketError(error)) {
        throw error;
      }

      await this.client.send(new CreateBucketCommand({ Bucket: this.options.bucket }));
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.options.bucket,
          Key: id,
          Body: file.body,
          ContentType: file.contentType,
          Metadata: file.metadata,
        }),
      );
    }
  }
}

function isMissingBucketError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error.name === "NoSuchBucket" || error.name === "NotFound")
  );
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

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  }

  return Buffer.concat(chunks);
}
