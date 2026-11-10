import { describe, expect, it, vi } from "vitest";
import type { StoredFileContent } from "@careerden/domain";
import type { SignedFileReader } from "../../domain/storage/signed-file-reader.js";
import { ReadSignedFileUseCase } from "./read-signed-file.use-case.js";

const file: StoredFileContent = {
  id: "file-1/cv.pdf",
  fileName: "cv.pdf",
  contentType: "application/pdf",
  size: 3,
  body: Buffer.from("pdf"),
};

function createReader(overrides: Partial<SignedFileReader> = {}) {
  return {
    verifySignedUrl: vi.fn(() => true),
    find: vi.fn(async () => file),
    ...overrides,
  } satisfies SignedFileReader;
}

describe("ReadSignedFileUseCase", () => {
  it("reads a file through a valid signed link", async () => {
    const reader = createReader();

    await expect(
      new ReadSignedFileUseCase(reader).execute({
        fileId: file.id,
        expires: "1000",
        signature: "sig",
      }),
    ).resolves.toBe(file);
    expect(reader.verifySignedUrl).toHaveBeenCalledWith({
      fileId: file.id,
      expires: "1000",
      signature: "sig",
    });
  });

  it.each([
    { expires: undefined, signature: "sig" },
    { expires: "1000", signature: undefined },
  ])("rejects a link without both signature parameters: %o", async (link) => {
    const reader = createReader();

    await expect(
      new ReadSignedFileUseCase(reader).execute({ fileId: file.id, ...link }),
    ).rejects.toMatchObject({ code: "forbidden", message: "Invalid or expired file link" });
    expect(reader.verifySignedUrl).not.toHaveBeenCalled();
    expect(reader.find).not.toHaveBeenCalled();
  });

  it("rejects an invalid or expired signature without reading the file", async () => {
    const reader = createReader({ verifySignedUrl: vi.fn(() => false) });

    await expect(
      new ReadSignedFileUseCase(reader).execute({
        fileId: file.id,
        expires: "1000",
        signature: "tampered",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(reader.find).not.toHaveBeenCalled();
  });

  it("reports a deleted file as not found", async () => {
    const reader = createReader({ find: vi.fn(async () => null) });

    await expect(
      new ReadSignedFileUseCase(reader).execute({
        fileId: file.id,
        expires: "1000",
        signature: "sig",
      }),
    ).rejects.toMatchObject({ code: "not_found", message: "File not found" });
  });
});
