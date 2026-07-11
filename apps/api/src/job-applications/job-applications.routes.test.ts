import { describe, expect, it, vi } from "vitest";
import type { FileStorage, GeneratedDocument, JobApplicationRepository } from "@link2cv/domain";
import { getGeneratedDocumentDownloadUrl } from "./job-applications.routes.js";

describe("job applications route behavior", () => {
  it("returns a signed URL for the selected document", async () => {
    const document = createGeneratedDocument({
      id: "doc-1",
      jobApplicationId: "job-1",
      fileId: "object-key/cv.pdf",
    });
    const jobApplications = createJobApplicationRepository({
      listGeneratedDocuments: vi.fn(async () => [document]),
    });
    const storage = createFileStorage({
      getSignedUrl: vi.fn(async () => "http://localhost:9000/link2cv-files/signed"),
    });

    const url = await getGeneratedDocumentDownloadUrl({
      jobApplications,
      storage,
      jobApplicationId: "job-1",
      documentId: "doc-1",
    });

    expect(jobApplications.listGeneratedDocuments).toHaveBeenCalledWith("job-1");
    expect(storage.getSignedUrl).toHaveBeenCalledWith("object-key/cv.pdf");
    expect(url).toBe("http://localhost:9000/link2cv-files/signed");
  });

  it("returns undefined when the selected document does not exist", async () => {
    const jobApplications = createJobApplicationRepository({
      listGeneratedDocuments: vi.fn(async () => []),
    });
    const storage = createFileStorage({
      getSignedUrl: vi.fn(),
    });

    const url = await getGeneratedDocumentDownloadUrl({
      jobApplications,
      storage,
      jobApplicationId: "job-1",
      documentId: "doc-1",
    });

    expect(url).toBeUndefined();
    expect(storage.getSignedUrl).not.toHaveBeenCalled();
  });
});

function createJobApplicationRepository(
  overrides: Partial<JobApplicationRepository> = {},
): JobApplicationRepository {
  return {
    create: vi.fn(),
    claimNextScrapeJob: vi.fn(async () => null),
    deleteById: vi.fn(),
    findById: vi.fn(),
    listByProfileId: vi.fn(async () => []),
    listByStatus: vi.fn(async () => []),
    resetProcessing: vi.fn(),
    resetAnalysis: vi.fn(),
    renewScrapeClaim: vi.fn(async () => null),
    recordScrapeFailure: vi.fn(async () => null),
    updateStatus: vi.fn(),
    updateTracking: vi.fn(),
    saveScrapeBundle: vi.fn(),
    getScrapeBundle: vi.fn(),
    getCompanyLogoFileId: vi.fn(async () => null),
    saveMatchAnalysis: vi.fn(),
    getMatchAnalysis: vi.fn(),
    saveDocumentContent: vi.fn(),
    getDocumentContent: vi.fn(async () => null),
    addEvent: vi.fn(),
    listEvents: vi.fn(async () => []),
    createContact: vi.fn(),
    findContactById: vi.fn(),
    listContacts: vi.fn(async () => []),
    updateContact: vi.fn(),
    deleteContact: vi.fn(),
    listFollowUps: vi.fn(async () => []),
    createFollowUp: vi.fn(),
    findFollowUpById: vi.fn(),
    updateFollowUp: vi.fn(),
    deleteFollowUp: vi.fn(),
    attachGeneratedDocument: vi.fn(),
    listGeneratedDocuments: vi.fn(async () => []),
    ...overrides,
  } as JobApplicationRepository;
}

function createFileStorage(overrides: Partial<FileStorage> = {}): FileStorage {
  return {
    put: vi.fn(),
    get: vi.fn(),
    getSignedUrl: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  } as FileStorage;
}

function createGeneratedDocument(overrides: Partial<GeneratedDocument> = {}): GeneratedDocument {
  return {
    id: "doc-1",
    jobApplicationId: "job-1",
    kind: "cv",
    format: "pdf",
    fileId: "object-key/cv.pdf",
    fileName: "cv.pdf",
    contentType: "application/pdf",
    createdAt: new Date("2026-06-14T00:00:00.000Z"),
    ...overrides,
  };
}
