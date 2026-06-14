import { randomUUID } from "node:crypto";
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { FileStorage, StoredFile, StoredFileInput } from "@link2cv/domain";

export interface RustFsFileStorageOptions {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region: string;
  publicEndpoint?: string;
  signedUrlExpiresInSeconds?: number;
}

export class RustFsFileStorage implements FileStorage {
  private readonly client: S3Client;
  private readonly signingClient: S3Client;
  private readonly signedUrlExpiresInSeconds: number;
  private bucketReady: Promise<void> | undefined;

  constructor(private readonly options: RustFsFileStorageOptions) {
    this.client = new S3Client(toS3ClientConfig(options, options.endpoint));
    this.signingClient = new S3Client(
      toS3ClientConfig(options, options.publicEndpoint ?? options.endpoint),
    );
    this.signedUrlExpiresInSeconds = options.signedUrlExpiresInSeconds ?? 900;
  }

  async put(file: StoredFileInput): Promise<StoredFile> {
    await this.ensureBucket();

    const key = `${randomUUID()}/${sanitizeFileName(file.fileName)}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: key,
        Body: file.body,
        ContentType: file.contentType,
        Metadata: file.metadata,
      }),
    );

    return {
      id: key,
      fileName: file.fileName,
      contentType: file.contentType,
      size: file.body.byteLength,
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
      this.signingClient,
      new GetObjectCommand({
        Bucket: this.options.bucket,
        Key: fileId,
      }),
      { expiresIn: this.signedUrlExpiresInSeconds },
    );
  }

  private async ensureBucket(): Promise<void> {
    this.bucketReady ??= this.createBucketIfMissing();
    await this.bucketReady;
  }

  private async createBucketIfMissing(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.options.bucket }));
      return;
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
    }

    try {
      await this.client.send(new CreateBucketCommand({ Bucket: this.options.bucket }));
    } catch (error) {
      if (!isBucketAlreadyOwnedError(error)) {
        throw error;
      }
    }
  }
}

function toS3ClientConfig(
  options: RustFsFileStorageOptions,
  endpoint: string,
): S3ClientConfig {
  return {
    endpoint,
    region: options.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
    },
  };
}

function sanitizeFileName(fileName: string): string {
  const sanitized = fileName.replaceAll(/[^a-zA-Z0-9._-]/g, "-");
  return sanitized.length > 0 ? sanitized : "file";
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "$metadata" in error &&
    (error as { $metadata?: { httpStatusCode?: number } }).$metadata
      ?.httpStatusCode === 404
  );
}

function isBucketAlreadyOwnedError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    ["BucketAlreadyOwnedByYou", "BucketAlreadyExists"].includes(
      String((error as { name?: string }).name),
    )
  );
}
