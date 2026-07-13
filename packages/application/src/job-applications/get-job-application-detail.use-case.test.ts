import { describe, expect, it, vi } from "vitest";
import {
  createJobApplicationRepository,
  createProfiles,
  createStorage,
  createTestJobApplication,
} from "./job-application-test-helpers.js";
import { GetJobApplicationDetailUseCase } from "./get-job-application-detail.use-case.js";

describe("GetJobApplicationDetailUseCase", () => {
  it("aggregates related data and removes internal logo fields", async () => {
    const job = createTestJobApplication();
    const repository = createJobApplicationRepository({
      findById: vi.fn(async () => job),
      getScrapeBundle: vi.fn(async () => ({
        job: {
          title: "Engineer",
          companyName: "Acme",
          description: "Build",
          requirements: [],
          raw: {},
        },
        companyLinkedIn: {
          name: "Acme",
          logoFileId: "logo-1",
          logoUrl: "remote",
          raw: {},
          websiteUrl: "https://www.acme.example/careers",
        },
      })),
      getCompanyLogoFileId: vi.fn(async () => "logo-1"),
    });

    const detail = await new GetJobApplicationDetailUseCase(
      repository,
      createProfiles(),
      createStorage({ getSignedUrl: vi.fn(async () => "signed-logo") }),
    ).execute(job.id, "user-1");

    expect(detail.companyLogoUrl).toBe("signed-logo");
    expect(detail.scrapeBundle?.companyLinkedIn).toEqual({
      name: "Acme",
      raw: {},
      websiteUrl: "https://www.acme.example/careers",
    });
  });
});
