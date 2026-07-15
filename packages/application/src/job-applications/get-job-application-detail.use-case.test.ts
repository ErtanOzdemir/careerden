import { describe, expect, it, vi } from "vitest";
import { richDocumentFromText, richDocumentToPlainText } from "@link2cv/domain";
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
          description: "Acme builds reliable products.",
          logoFileId: "logo-1",
          logoUrl: "remote",
          raw: {},
          websiteUrl: "https://www.acme.example/careers",
        },
      })),
      getCompanyLogoFileId: vi.fn(async () => "logo-1"),
      getDocumentContent: vi.fn(async () => ({
        customizedSummary: richDocumentFromText("Summary"),
        experienceEnhancements: [
          {
            experienceIndex: 0,
            description: richDocumentFromText("Tailored experience"),
            achievements: [richDocumentFromText("Legacy achievement")],
          },
        ],
        selections: { education: {}, experience: {}, projects: {} },
      })),
    });

    const detail = await new GetJobApplicationDetailUseCase(
      repository,
      createProfiles(),
      createStorage({ getSignedUrl: vi.fn(async () => "signed-logo") }),
    ).execute(job.id, "user-1");

    expect(detail.companyLogoUrl).toBe("signed-logo");
    expect(detail.profileReadiness).toEqual({ state: "ready", warnings: [] });
    expect(detail.documentContent?.formatVersion).toBe(2);
    expect(
      richDocumentToPlainText(detail.documentContent!.experienceEnhancements[0]!.description!),
    ).toBe("Tailored experience. Legacy achievement.");
    expect(detail.documentContent?.experienceEnhancements[0]?.achievements).toEqual([]);
    expect(detail.scrapeBundle?.companyLinkedIn).toEqual({
      name: "Acme",
      description: "Acme builds reliable products.",
      raw: {},
      websiteUrl: "https://www.acme.example/careers",
    });
  });

  it("returns blocked readiness for an empty career profile", async () => {
    const job = createTestJobApplication();
    const profiles = createProfiles();
    vi.mocked(profiles.findById).mockResolvedValue({
      ...(await profiles.findById(job.profileId))!,
      headline: undefined,
      skills: [],
      experience: [],
    });

    const detail = await new GetJobApplicationDetailUseCase(
      createJobApplicationRepository({ findById: vi.fn(async () => job) }),
      profiles,
      createStorage(),
    ).execute(job.id, "user-1");

    expect(detail.profileReadiness).toEqual({
      state: "blocked",
      warnings: ["positioning", "skills", "evidence"],
    });
  });
});
