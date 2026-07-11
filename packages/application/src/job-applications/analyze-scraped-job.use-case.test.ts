import { describe, expect, it } from "vitest";
import type { AiGenerateParams, AiProvider } from "@link2cv/domain";
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

    await new AnalyzeScrapedJobUseCase(
      jobApplications,
      profiles,
      new RunMatchAnalysisUseCase(createAiProvider(), jobApplications),
    ).execute({ jobApplicationId: jobApplication.id });

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

    await expect(
      new AnalyzeScrapedJobUseCase(
        jobApplications,
        profiles,
        new RunMatchAnalysisUseCase(createAiProvider(), jobApplications),
      ).execute({ jobApplicationId: jobApplication.id }),
    ).rejects.toThrow(`No desktop scrape bundle found for job application ${jobApplication.id}`);

    const failed = await jobApplications.findById(jobApplication.id);
    const events = await jobApplications.listEvents(jobApplication.id);

    expect(failed?.status).toBe("failed");
    expect(failed?.failureReason).toBe(
      `No desktop scrape bundle found for job application ${jobApplication.id}`,
    );
    expect(events.map((event) => event.title)).toContain("AI analysis failed");
  });
});

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
