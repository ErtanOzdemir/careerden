import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RustFsFileStorage } from "./rustfs-file.storage.js";

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(async () => "http://localhost:9000/link2cv-files/signed.pdf"),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RustFsFileStorage", () => {
  it("creates the bucket when missing and uploads the file", async () => {
    const sent: unknown[] = [];
    mockS3Send(async (command) => {
      sent.push(command);

      if (command instanceof HeadBucketCommand) {
        throw { $metadata: { httpStatusCode: 404 } };
      }

      return {};
    });

    const storage = createStorage();

    const stored = await storage.put({
      fileName: "cover letter.pdf",
      contentType: "application/pdf",
      body: Buffer.from("pdf"),
      metadata: {
        jobApplicationId: "job-1",
        kind: "cover_letter",
      },
    });

    expect(sent[0]).toBeInstanceOf(HeadBucketCommand);
    expect(sent[1]).toBeInstanceOf(CreateBucketCommand);
    expect(sent[2]).toBeInstanceOf(PutObjectCommand);
    expect(commandInput(sent[1])).toMatchObject({ Bucket: "link2cv-files" });
    expect(commandInput(sent[2])).toMatchObject({
      Bucket: "link2cv-files",
      Key: stored.id,
      Body: Buffer.from("pdf"),
      ContentType: "application/pdf",
      Metadata: {
        jobApplicationId: "job-1",
        kind: "cover_letter",
      },
    });
    expect(stored).toMatchObject({
      fileName: "cover letter.pdf",
      contentType: "application/pdf",
      size: 3,
    });
    expect(stored.id).toMatch(
      /^[0-9a-f-]{36}\/cover-letter\.pdf$/,
    );
  });

  it("reuses the bucket readiness check across uploads", async () => {
    const sent: unknown[] = [];
    mockS3Send(async (command) => {
      sent.push(command);
      return {};
    });

    const storage = createStorage();

    await storage.put({
      fileName: "cv.pdf",
      contentType: "application/pdf",
      body: Buffer.from("cv"),
    });
    await storage.put({
      fileName: "cover-letter.pdf",
      contentType: "application/pdf",
      body: Buffer.from("cover"),
    });

    expect(sent.filter((command) => command instanceof HeadBucketCommand)).toHaveLength(1);
    expect(sent.filter((command) => command instanceof CreateBucketCommand)).toHaveLength(0);
    expect(sent.filter((command) => command instanceof PutObjectCommand)).toHaveLength(2);
  });

  it("returns a presigned URL for an existing object", async () => {
    const sent: unknown[] = [];
    mockS3Send(async (command) => {
      sent.push(command);
      return {};
    });

    const storage = createStorage();
    const url = await storage.getSignedUrl("document-id/cv.pdf");

    expect(url).toBe("http://localhost:9000/link2cv-files/signed.pdf");
    expect(sent).toHaveLength(1);
    expect(sent[0]).toBeInstanceOf(HeadObjectCommand);
    expect(commandInput(sent[0])).toMatchObject({
      Bucket: "link2cv-files",
      Key: "document-id/cv.pdf",
    });

    const mockedGetSignedUrl = vi.mocked(getSignedUrl);
    expect(mockedGetSignedUrl).toHaveBeenCalledTimes(1);
    expect(mockedGetSignedUrl.mock.calls[0]?.[1]).toBeInstanceOf(GetObjectCommand);
    expect(commandInput(mockedGetSignedUrl.mock.calls[0]?.[1])).toMatchObject({
      Bucket: "link2cv-files",
      Key: "document-id/cv.pdf",
    });
    expect(mockedGetSignedUrl.mock.calls[0]?.[2]).toMatchObject({
      expiresIn: 900,
    });
  });
});

function createStorage(): RustFsFileStorage {
  return new RustFsFileStorage({
    endpoint: "http://rustfs:9000",
    publicEndpoint: "http://localhost:9000",
    accessKeyId: "rustfsadmin",
    secretAccessKey: "rustfsadmin",
    bucket: "link2cv-files",
    region: "us-east-1",
  });
}

function mockS3Send(implementation: (command: unknown) => Promise<unknown>): void {
  vi.spyOn(S3Client.prototype, "send").mockImplementation(implementation as never);
}

function commandInput(command: unknown): Record<string, unknown> {
  return (command as { input: Record<string, unknown> }).input;
}
