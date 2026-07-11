import { describe, expect, it, vi } from "vitest";
import {
  ExtractJobRequirementsUseCase,
  GenerateDocumentsUseCase,
  GenerateJobApplicationDocumentsUseCase,
  JobApplicationChangeNotifier,
  ProcessJobApplicationUseCase,
  RunMatchAnalysisUseCase,
} from "../index.js";
import type { AiProvider, AiGenerateParams, JobSiteScraper } from "@link2cv/domain";
import {
  InMemoryJobApplicationRepository,
  InMemoryUserProfileRepository,
} from "@link2cv/infrastructure";
import { createUnitOfWork } from "./job-application-test-helpers.js";

describe("ProcessJobApplicationUseCase", () => {
  it("moves a job application through the full pipeline", async () => {
    const profiles = new InMemoryUserProfileRepository();
    const jobApplications = new InMemoryJobApplicationRepository();
    const profile = await profiles.create({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      skills: ["TypeScript"],
      experience: [
        {
          company: "Analytical Engines",
          title: "Engineer",
          description: "Built reliable automation",
        },
      ],
    });
    const jobApplication = await jobApplications.create({
      profileId: profile.id,
      sourceUrl: "https://www.linkedin.com/jobs/view/123",
    });
    const scraper = createScraper();
    const aiProvider = createMockAiProvider();
    const requirementExtraction = new ExtractJobRequirementsUseCase(aiProvider);
    const matching = new RunMatchAnalysisUseCase(aiProvider);
    const logoStorage = {
      put: vi.fn(async () => ({
        id: "logos/example.png",
        fileName: "company-logo.png",
        contentType: "image/png",
        size: 4,
      })),
      get: vi.fn(),
      getSignedUrl: vi.fn(),
    };
    const documents = new GenerateDocumentsUseCase(
      {
        async render() {
          return "<html><body>Document</body></html>";
        },
      },
      {
        async htmlToPdf() {
          return Buffer.from("pdf");
        },
      },
      {
        async put(file) {
          return {
            id: "file-1",
            fileName: file.fileName,
            contentType: file.contentType,
            size: file.body.byteLength,
          };
        },
        async get() {
          return {
            id: "file-1",
            fileName: "file.docx",
            contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            size: 0,
            body: Buffer.from(""),
          };
        },
        async getSignedUrl() {
          return "file://file-1";
        },
      },
      jobApplications,
      profiles,
    );

    await new ProcessJobApplicationUseCase(
      jobApplications,
      profiles,
      {
        job: scraper,
        companyLinkedIn: scraper,
        companyWebsite: scraper,
        careerPage: scraper,
      },
      new JobApplicationChangeNotifier({ publish: vi.fn() }),
      requirementExtraction,
      matching,
      logoStorage,
      { fetch: vi.fn(async () => ({ body: Buffer.from("logo"), contentType: "image/png" })) },
    ).execute(jobApplication.id);

    const readyForReview = await jobApplications.findById(jobApplication.id);
    const generated = await jobApplications.listGeneratedDocuments(jobApplication.id);
    const scrape = await jobApplications.getScrapeBundle(jobApplication.id);
    const events = await jobApplications.listEvents(jobApplication.id);
    const enrichedJob = await jobApplications.findById(jobApplication.id);

    expect(readyForReview?.status).toBe("review_ready");
    expect(scrape?.job.requirements).toEqual(["TypeScript", "Kubernetes"]);
    expect(enrichedJob?.tracking.companyName).toBe("Example Inc");
    expect(scrape?.companyLinkedIn?.logoFileId).toBe("logos/example.png");
    expect(logoStorage.put).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: "company-logo.png",
        metadata: expect.objectContaining({ kind: "company_logo" }),
      }),
    );
    expect(enrichedJob?.tracking.roleTitle).toBe("Backend Engineer");
    expect(generated).toHaveLength(0);
    expect(events.map((event) => event.title)).toContain("Scraping completed");
    expect(events.map((event) => event.title)).toContain("Ready for AI match review");

    await new GenerateJobApplicationDocumentsUseCase(
      jobApplications,
      profiles,
      documents,
      createUnitOfWork(jobApplications, profiles as never).unitOfWork,
    ).execute(jobApplication.id);

    const completed = await jobApplications.findById(jobApplication.id);
    const generatedAfterApproval = await jobApplications.listGeneratedDocuments(jobApplication.id);
    const eventsAfterApproval = await jobApplications.listEvents(jobApplication.id);

    expect(completed?.status).toBe("completed");
    expect(generatedAfterApproval).toHaveLength(2);
    expect(eventsAfterApproval.map((event) => event.title)).toContain(
      "Document generation completed",
    );

    await new GenerateJobApplicationDocumentsUseCase(
      jobApplications,
      profiles,
      documents,
      createUnitOfWork(jobApplications, profiles as never).unitOfWork,
    ).execute(jobApplication.id);

    expect((await jobApplications.findById(jobApplication.id))?.status).toBe("completed");
    expect(await jobApplications.listGeneratedDocuments(jobApplication.id)).toHaveLength(2);
  });

  it("continues processing when the company logo cannot be downloaded", async () => {
    const profiles = new InMemoryUserProfileRepository();
    const jobApplications = new InMemoryJobApplicationRepository();
    const profile = await profiles.create({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      skills: ["TypeScript"],
      experience: [],
    });
    const jobApplication = await jobApplications.create({
      profileId: profile.id,
      sourceUrl: "https://www.linkedin.com/jobs/view/456",
    });
    const scraper = createScraper();
    const aiProvider = createMockAiProvider();
    const storage = {
      put: vi.fn(),
      get: vi.fn(),
      getSignedUrl: vi.fn(),
    };

    await new ProcessJobApplicationUseCase(
      jobApplications,
      profiles,
      {
        job: scraper,
        companyLinkedIn: scraper,
        companyWebsite: scraper,
        careerPage: scraper,
      },
      new JobApplicationChangeNotifier({ publish: vi.fn() }),
      new ExtractJobRequirementsUseCase(aiProvider),
      new RunMatchAnalysisUseCase(aiProvider),
      storage,
      { fetch: vi.fn(async () => Promise.reject(new Error("download failed"))) },
    ).execute(jobApplication.id);

    expect((await jobApplications.findById(jobApplication.id))?.status).toBe("review_ready");
    expect(await jobApplications.getCompanyLogoFileId(jobApplication.id)).toBeNull();
    expect(storage.put).not.toHaveBeenCalled();
  });
});

function createScraper(): JobSiteScraper {
  return {
    canHandle() {
      return true;
    },
    async scrapeJob(url) {
      return {
        title: "Backend Engineer",
        companyName: "Example Inc",
        description: "Build TypeScript services",
        requirements: [],
        companyLinkedInUrl: "https://www.linkedin.com/company/example",
        raw: { url },
      };
    },
    async scrapeCompany(input) {
      return {
        name: input.companyName,
        linkedInUrl: input.linkedInUrl,
        logoUrl: "https://media.licdn.com/dms/image/example-logo",
        websiteUrl: input.websiteUrl ?? "https://example.com",
        careerPageUrl: "https://example.com/careers",
        raw: input,
      };
    },
  };
}

function createMockAiProvider(): AiProvider {
  return {
    async generate<T>(params: AiGenerateParams<T>): Promise<T> {
      const prompt = JSON.parse(params.prompt) as {
        description?: string;
        scrapedJob?: { requirements?: string[] };
      };

      if ("description" in prompt) {
        return params.outputSchema.parse({
          requirements: ["TypeScript", "Kubernetes"],
        }) as T;
      }

      expect(prompt.scrapedJob?.requirements).toEqual(["TypeScript", "Kubernetes"]);

      return params.outputSchema.parse({
        matchScore: 85,
        missingSkills: ["Kubernetes"],
        strongSkills: ["TypeScript"],
        recommendedAchievements: ["Built reliable automation"],
        customizedSummary: "Experienced TypeScript engineer with relevant skills.",
        interviewTips: ["Prepare examples of automation work"],
        coverLetterGuidance: ["Highlight TypeScript experience"],
      });
    },
  };
}
