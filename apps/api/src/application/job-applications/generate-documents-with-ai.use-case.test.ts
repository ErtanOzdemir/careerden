import { describe, expect, it, vi } from "vitest";
import { richDocumentFromText } from "@careerden/domain";
import type { PremiumAiService } from "../../domain/matching/premium-ai-service.js";
import {
  InMemoryJobApplicationRepository,
  InMemoryUserProfileRepository,
} from "@careerden/infrastructure";
import { GenerateDocumentsWithAiUseCase } from "./generate-documents-with-ai.use-case.js";
import { createUnitOfWork } from "@careerden/application/testing";

describe("GenerateDocumentsWithAiUseCase", () => {
  it("atomically persists premium AI content and staged documents", async () => {
    const { profiles, jobApplications, jobApplication } = await createState();
    const premiumAi = createPremiumAi();
    const { unitOfWork, recordChanged } = createUnitOfWork(jobApplications, profiles as never);
    const generation = {
      stage: vi.fn(async (input: { generationAttemptId: string }) => [
        {
          kind: "cv",
          format: "pdf",
          fileId: `files/${input.generationAttemptId}/cv.pdf`,
          fileName: "cv.pdf",
          contentType: "application/pdf",
        },
      ]),
    };

    const documents = await new GenerateDocumentsWithAiUseCase(
      premiumAi,
      generation as never,
      jobApplications,
      profiles,
      unitOfWork,
    ).execute({
      jobApplicationId: jobApplication.id,
      preferences: preferences,
    });

    expect(documents).toHaveLength(1);
    expect((await jobApplications.findById(jobApplication.id))?.status).toBe("completed");
    expect(await jobApplications.getMatchAnalysis(jobApplication.id)).toMatchObject({
      matchScore: 90,
    });
    expect(recordChanged).toHaveBeenCalledTimes(2);
  });

  it("fails the current attempt and schedules deterministic cleanup when premium AI fails", async () => {
    const { profiles, jobApplications, jobApplication } = await createState();
    const premiumAi: PremiumAiService = {
      generate: vi.fn(async () => {
        throw new Error("provider unavailable");
      }),
    };
    const { unitOfWork, addOutboxEvent } = createUnitOfWork(jobApplications, profiles as never);

    await expect(
      new GenerateDocumentsWithAiUseCase(
        premiumAi,
        { stage: vi.fn() } as never,
        jobApplications,
        profiles,
        unitOfWork,
      ).execute({ jobApplicationId: jobApplication.id, preferences }),
    ).rejects.toThrow("provider unavailable");

    expect((await jobApplications.findById(jobApplication.id))?.status).toBe("failed");
    expect(addOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "storage.delete" }),
    );
  });
});

const preferences = {
  templateId: "default",
  documentType: "both" as const,
  language: "en",
  tone: "professional" as const,
};

async function createState() {
  const profiles = new InMemoryUserProfileRepository();
  const jobApplications = new InMemoryJobApplicationRepository();
  const profile = await profiles.create({
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    skillGroups: [{ name: "", skills: ["TypeScript"] }],
    experience: [],
  });
  const jobApplication = await jobApplications.create({ profileId: profile.id });
  await jobApplications.saveScrapeBundle(jobApplication.id, {
    job: {
      title: "Engineer",
      companyName: "Acme",
      description: "Build software",
      requirements: [],
      raw: {},
    },
  });
  await jobApplications.updateStatus(jobApplication.id, "review_ready");
  return { profiles, jobApplications, jobApplication };
}

function createPremiumAi(): PremiumAiService {
  return {
    generate: vi.fn(async () => ({
      matchAnalysis: {
        matchScore: 90,
        missingSkills: [],
        strongSkills: ["TypeScript"],
        recommendedAchievements: [],
        customizedSummary: "Summary",
        interviewTips: [],
      },
      documentContent: {
        customizedSummary: richDocumentFromText("Summary"),
        experienceEnhancements: [],
      },
      keywords: ["TypeScript"],
      creditsRemaining: 4,
    })),
  };
}
