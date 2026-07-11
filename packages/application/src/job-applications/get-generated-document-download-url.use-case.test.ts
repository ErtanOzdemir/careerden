import { describe, expect, it, vi } from "vitest";
import {
  createJobApplicationRepository,
  createProfiles,
  createStorage,
  createTestJobApplication,
} from "./job-application-test-helpers.js";
import { GetGeneratedDocumentDownloadUrlUseCase } from "./get-generated-document-download-url.use-case.js";

describe("GetGeneratedDocumentDownloadUrlUseCase", () => {
  it("returns a signed URL for an owned generated document", async () => {
    const job = createTestJobApplication();
    const repository = createJobApplicationRepository({
      findById: vi.fn(async () => job),
      listGeneratedDocuments: vi.fn(async () => [{ id: "document-1", fileId: "file-1" }] as never),
    });
    const storage = createStorage({ getSignedUrl: vi.fn(async () => "signed-url") });

    await expect(
      new GetGeneratedDocumentDownloadUrlUseCase(repository, createProfiles(), storage).execute(
        job.id,
        "document-1",
        "user-1",
      ),
    ).resolves.toBe("signed-url");
    expect(storage.getSignedUrl).toHaveBeenCalledWith("file-1");
  });
});
