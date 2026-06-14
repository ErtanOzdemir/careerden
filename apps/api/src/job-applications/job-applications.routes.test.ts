import { describe, expect, it, vi } from "vitest";
import type {
  FileStorage,
  GeneratedDocument,
  JobApplication,
  JobApplicationRepository,
} from "@link2cv/domain";
import {
  getGeneratedDocumentDownloadUrl,
  listJobApplicationsWithDocuments,
} from "./job-applications.routes.js";

describe("job applications route behavior", () => {
  it("includes generated documents in the job list response", async () => {
    const job = createJobApplication({ id: "job-1" });
    const document = createGeneratedDocument({
      id: "doc-1",
      jobApplicationId: job.id,
      kind: "cv",
      fileId: "object-key/cv.pdf",
      fileName: "cv.pdf",
    });
    const jobApplications = createJobApplicationRepository({
      listByProfileId: vi.fn(async () => [job]),
      listGeneratedDocuments: vi.fn(async (jobApplicationId: string) =>
        jobApplicationId === job.id ? [document] : [],
      ),
    });

    const result = await listJobApplicationsWithDocuments(
      jobApplications,
      "profile-1",
    );

    expect(jobApplications.listByProfileId).toHaveBeenCalledWith("profile-1");
    expect(jobApplications.listGeneratedDocuments).toHaveBeenCalledWith("job-1");
    expect(result).toEqual([
      {
        ...job,
        documents: [document],
      },
    ]);
  });

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
    findById: vi.fn(),
    listByProfileId: vi.fn(async () => []),
    listByStatus: vi.fn(async () => []),
    updateStatus: vi.fn(),
    saveScrapeBundle: vi.fn(),
    getScrapeBundle: vi.fn(),
    saveMatchAnalysis: vi.fn(),
    getMatchAnalysis: vi.fn(),
    attachGeneratedDocument: vi.fn(),
    listGeneratedDocuments: vi.fn(async () => []),
    ...overrides,
  } as JobApplicationRepository;
}

function createFileStorage(overrides: Partial<FileStorage> = {}): FileStorage {
  return {
    put: vi.fn(),
    getSignedUrl: vi.fn(),
    ...overrides,
  } as FileStorage;
}

function createJobApplication(overrides: Partial<JobApplication> = {}): JobApplication {
  const now = new Date("2026-06-14T00:00:00.000Z");

  return {
    id: "job-1",
    profileId: "profile-1",
    sourceUrl: "https://www.linkedin.com/jobs/view/1",
    status: "completed",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createGeneratedDocument(
  overrides: Partial<GeneratedDocument> = {},
): GeneratedDocument {
  return {
    id: "doc-1",
    jobApplicationId: "job-1",
    kind: "cv",
    fileId: "object-key/cv.pdf",
    fileName: "cv.pdf",
    contentType: "application/pdf",
    createdAt: new Date("2026-06-14T00:00:00.000Z"),
    ...overrides,
  };
}
