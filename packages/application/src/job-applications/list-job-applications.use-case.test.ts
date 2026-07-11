import { describe, expect, it, vi } from "vitest";
import {
  createJobApplicationRepository,
  createProfiles,
  createStorage,
  createTestJobApplication,
} from "./job-application-test-helpers.js";
import { ListJobApplicationsUseCase } from "./list-job-applications.use-case.js";

describe("ListJobApplicationsUseCase", () => {
  it("returns list read models with documents, logo URL, and match score", async () => {
    const job = createTestJobApplication();
    const repository = createJobApplicationRepository({
      listByProfileId: vi.fn(async () => [job]),
      listGeneratedDocuments: vi.fn(async () => [{ id: "document-1" }] as never),
      getCompanyLogoFileId: vi.fn(async () => "logo-1"),
      getMatchAnalysis: vi.fn(async () => ({ matchScore: 82 }) as never),
    });
    const storage = createStorage({ getSignedUrl: vi.fn(async () => "signed-logo") });

    const result = await new ListJobApplicationsUseCase(
      repository,
      createProfiles(),
      storage,
    ).execute("profile-1", "user-1");

    expect(result[0]).toMatchObject({ companyLogoUrl: "signed-logo", matchScore: 82 });
    expect(result[0]?.documents).toHaveLength(1);
  });
});
