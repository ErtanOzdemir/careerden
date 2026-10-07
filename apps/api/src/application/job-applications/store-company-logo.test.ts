import { describe, expect, it, vi } from "vitest";
import type { FileStorage } from "@careerden/domain";
import type { RemoteImageFetcher } from "../../domain/scraping/remote-image-fetcher.js";
import { storeCompanyLogo } from "./store-company-logo.js";

describe("storeCompanyLogo", () => {
  it("uses a deterministic per-application key and returns the enriched scrape", async () => {
    const storage = createStorage();
    const remoteImages: RemoteImageFetcher = {
      fetch: vi.fn(async () => ({ body: Buffer.from("logo"), contentType: "image/png" })),
    };

    const result = await storeCompanyLogo({
      jobApplicationId: "job-1",
      scrape: {
        job: {
          title: "Engineer",
          companyName: "Acme",
          description: "Build software",
          requirements: [],
          raw: {},
        },
        companyLinkedIn: { name: "Acme", logoUrl: "https://example.com/logo.png", raw: {} },
      },
      remoteImages,
      storage,
    });

    expect(storage.put).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "job-applications/job-1/company-logo/company-logo.png",
      }),
    );
    expect(result.uploadedFileId).toBe("job-applications/job-1/company-logo/company-logo.png");
    expect(result.scrape.companyLinkedIn?.logoFileId).toBe(result.uploadedFileId);
  });
});

function createStorage(): FileStorage {
  return {
    put: vi.fn(async (input) => ({
      id: input.key ?? "file-1",
      fileName: input.fileName,
      contentType: input.contentType,
      size: input.body.byteLength,
    })),
    get: vi.fn(),
    getSignedUrl: vi.fn(),
    delete: vi.fn(),
  };
}
