import { describe, expect, it, vi } from "vitest";
import {
  InMemoryJobApplicationRepository,
  InMemoryUserProfileRepository,
} from "@link2cv/infrastructure";
import { createUnitOfWork } from "./job-application-test-helpers.js";
import { FailApplicationPackGenerationUseCase } from "./fail-application-pack-generation.use-case.js";
import { GenerateRequestedApplicationPackUseCase } from "./generate-requested-application-pack.use-case.js";

describe("GenerateRequestedApplicationPackUseCase", () => {
  it("attaches staged files and completes the current generation attempt", async () => {
    const { profiles, jobApplications, jobApplication } = await createReadyApplication();
    await jobApplications.beginDocumentGeneration(jobApplication.id, "attempt-1");
    const { unitOfWork } = createUnitOfWork(jobApplications, profiles as never);
    const documentGeneration = {
      stage: vi.fn(async () => [
        {
          kind: "cv" as const,
          format: "pdf" as const,
          fileId: "files/attempt-1/cv.pdf",
          fileName: "cv.pdf",
          contentType: "application/pdf",
        },
      ]),
    };

    await new GenerateRequestedApplicationPackUseCase(
      jobApplications,
      profiles,
      documentGeneration as never,
      unitOfWork,
    ).execute({ jobApplicationId: jobApplication.id, generationAttemptId: "attempt-1" });

    expect((await jobApplications.findById(jobApplication.id))?.status).toBe("completed");
    expect(await jobApplications.listGeneratedDocuments(jobApplication.id)).toMatchObject([
      { kind: "cv", format: "pdf", fileName: "cv.pdf" },
    ]);
  });

  it("ignores a superseded queue delivery without rendering", async () => {
    const { profiles, jobApplications, jobApplication } = await createReadyApplication();
    await jobApplications.beginDocumentGeneration(jobApplication.id, "current-attempt");
    const { unitOfWork } = createUnitOfWork(jobApplications, profiles as never);
    const stage = vi.fn();

    await new GenerateRequestedApplicationPackUseCase(
      jobApplications,
      profiles,
      { stage } as never,
      unitOfWork,
    ).execute({ jobApplicationId: jobApplication.id, generationAttemptId: "stale-attempt" });

    expect(stage).not.toHaveBeenCalled();
  });

  it("marks the attempt failed only when terminal failure handling is requested", async () => {
    const { profiles, jobApplications, jobApplication } = await createReadyApplication();
    await jobApplications.beginDocumentGeneration(jobApplication.id, "attempt-1");
    const { unitOfWork, addOutboxEvent } = createUnitOfWork(jobApplications, profiles as never);

    await new FailApplicationPackGenerationUseCase(unitOfWork).execute(
      { jobApplicationId: jobApplication.id, generationAttemptId: "attempt-1" },
      "Gotenberg unavailable",
    );

    expect(await jobApplications.findById(jobApplication.id)).toMatchObject({
      status: "failed",
      failureReason: "Gotenberg unavailable",
    });
    expect(addOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "storage.delete",
        payload: expect.objectContaining({ fileId: expect.stringContaining("/attempt-1/") }),
      }),
    );
  });
});

async function createReadyApplication() {
  const profiles = new InMemoryUserProfileRepository();
  const profile = await profiles.create({
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    skills: ["TypeScript"],
    experience: [],
  });
  const jobApplications = new InMemoryJobApplicationRepository();
  const jobApplication = await jobApplications.create({ profileId: profile.id });
  await jobApplications.saveMatchAnalysis(jobApplication.id, {
    matchScore: 90,
    missingSkills: [],
    strongSkills: ["TypeScript"],
    recommendedAchievements: [],
    customizedSummary: "Summary",
    interviewTips: [],
  });
  await jobApplications.updateStatus(jobApplication.id, "review_ready");
  return { profiles, jobApplications, jobApplication };
}
