import { describe, expect, it, vi } from "vitest";
import type { AiGenerateParams, AiProvider, PersistenceUnitOfWork } from "@link2cv/domain";
import {
  InMemoryJobApplicationRepository,
  InMemoryUserProfileRepository,
} from "@link2cv/infrastructure";
import { AnalyzeScrapedJobUseCase } from "./analyze-scraped-job.use-case.js";
import { RunMatchAnalysisUseCase } from "../matching/run-match-analysis.use-case.js";

describe("AnalyzeScrapedJobUseCase", () => {
  it("runs AI analysis for a scraped job and marks it ready for review", async () => {
    const profiles = new InMemoryUserProfileRepository();
    const jobApplications = new InMemoryJobApplicationRepository();
    const profile = await profiles.create({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      skills: ["TypeScript"],
      experience: [{ company: "Engines", title: "Engineer", description: "Built tools" }],
    });
    const jobApplication = await jobApplications.create({
      profileId: profile.id,
      sourceUrl: "https://www.linkedin.com/jobs/view/123",
    });
    await jobApplications.saveScrapeBundle(jobApplication.id, {
      job: {
        title: "Backend Engineer",
        companyName: "Example Inc",
        description: "Build TypeScript services",
        requirements: ["TypeScript"],
        raw: {},
      },
    });
    await jobApplications.updateStatus(jobApplication.id, "scraped");
    await jobApplications.setAnalysisAttempt(jobApplication.id, "attempt-1");
    const { unitOfWork, recordChanged } = createUnitOfWork(jobApplications, profiles);

    await new AnalyzeScrapedJobUseCase(
      jobApplications,
      profiles,
      new RunMatchAnalysisUseCase(createAiProvider()),
      unitOfWork,
    ).execute({ jobApplicationId: jobApplication.id, analysisAttemptId: "attempt-1" });

    const analyzed = await jobApplications.findById(jobApplication.id);
    const analysis = await jobApplications.getMatchAnalysis(jobApplication.id);
    const content = await jobApplications.getDocumentContent(jobApplication.id);
    const events = await jobApplications.listEvents(jobApplication.id);

    expect(analyzed?.status).toBe("review_ready");
    expect(analysis?.matchScore).toBe(91);
    expect(content?.customizedSummary.blocks[0]?.children[0]?.text).toBe(
      "Strong TypeScript backend engineer.",
    );
    expect(events.map((event) => event.title)).toEqual(
      expect.arrayContaining([
        "AI analysis started",
        "AI analysis completed",
        "Ready for AI match review",
      ]),
    );
    expect(recordChanged).toHaveBeenCalledTimes(2);
  });

  it("marks the job failed when required scraped data is missing", async () => {
    const profiles = new InMemoryUserProfileRepository();
    const jobApplications = new InMemoryJobApplicationRepository();
    const profile = await profiles.create({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      skills: [],
      experience: [],
    });
    const jobApplication = await jobApplications.create({
      profileId: profile.id,
      sourceUrl: "https://www.linkedin.com/jobs/view/123",
    });
    await jobApplications.updateStatus(jobApplication.id, "scraped");
    await jobApplications.setAnalysisAttempt(jobApplication.id, "attempt-1");
    const { unitOfWork, recordChanged } = createUnitOfWork(jobApplications, profiles);

    await expect(
      new AnalyzeScrapedJobUseCase(
        jobApplications,
        profiles,
        new RunMatchAnalysisUseCase(createAiProvider()),
        unitOfWork,
      ).execute({ jobApplicationId: jobApplication.id, analysisAttemptId: "attempt-1" }),
    ).rejects.toThrow(`No desktop scrape bundle found for job application ${jobApplication.id}`);

    const failed = await jobApplications.findById(jobApplication.id);
    const events = await jobApplications.listEvents(jobApplication.id);

    expect(failed?.status).toBe("failed");
    expect(failed?.failureReason).toBe(
      `No desktop scrape bundle found for job application ${jobApplication.id}`,
    );
    expect(events.map((event) => event.title)).toContain("AI analysis failed");
    expect(recordChanged).toHaveBeenCalledTimes(2);
  });

  it("ignores a stale analysis attempt without calling the AI provider", async () => {
    const profiles = new InMemoryUserProfileRepository();
    const jobApplications = new InMemoryJobApplicationRepository();
    const profile = await profiles.create({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      skills: [],
      experience: [],
    });
    const jobApplication = await jobApplications.create({
      profileId: profile.id,
      sourceUrl: "https://www.linkedin.com/jobs/view/123",
    });
    await jobApplications.updateStatus(jobApplication.id, "scraped");
    await jobApplications.setAnalysisAttempt(jobApplication.id, "current-attempt");
    const { unitOfWork, recordChanged } = createUnitOfWork(jobApplications, profiles);
    const aiProvider = createAiProvider();
    const generate = vi.spyOn(aiProvider, "generate");

    await new AnalyzeScrapedJobUseCase(
      jobApplications,
      profiles,
      new RunMatchAnalysisUseCase(aiProvider),
      unitOfWork,
    ).execute({ jobApplicationId: jobApplication.id, analysisAttemptId: "stale-attempt" });

    expect(generate).not.toHaveBeenCalled();
    expect((await jobApplications.findById(jobApplication.id))?.status).toBe("scraped");
    expect(recordChanged).not.toHaveBeenCalled();
  });
});

function createUnitOfWork(
  jobApplications: InMemoryJobApplicationRepository,
  profiles: InMemoryUserProfileRepository,
): {
  unitOfWork: PersistenceUnitOfWork;
  addOutboxEvent: ReturnType<typeof vi.fn>;
  recordChanged: ReturnType<typeof vi.fn>;
} {
  const addOutboxEvent = vi.fn(async (input) => ({
    ...input,
    id: `outbox-${addOutboxEvent.mock.calls.length}`,
    attemptCount: 0,
  }));
  const recordChanged = vi.fn();
  return {
    addOutboxEvent,
    recordChanged,
    unitOfWork: {
      execute: async (work) =>
        work({
          jobApplications,
          jobApplicationChanges: { changed: recordChanged, deleted: vi.fn() },
          profiles: profiles as never,
          notifications: {} as never,
          followUpReminders: {} as never,
          outbox: { add: addOutboxEvent },
        }),
    },
  };
}

function createAiProvider(): AiProvider {
  return {
    async generate<T>(params: AiGenerateParams<T>): Promise<T> {
      return params.outputSchema.parse({
        matchScore: 91,
        missingSkills: [],
        strongSkills: ["TypeScript"],
        recommendedAchievements: ["Built tools"],
        customizedSummary: "Strong TypeScript backend engineer.",
        interviewTips: ["Prepare backend examples"],
        coverLetterGuidance: ["Emphasize TypeScript"],
      }) as T;
    },
  };
}
