import { describe, expect, it, vi } from "vitest";
import {
  InMemoryJobApplicationRepository,
  InMemoryUserProfileRepository,
} from "@link2cv/infrastructure";
import { GenerateJobApplicationDocumentsUseCase } from "./generate-job-application-documents.use-case.js";
import { createUnitOfWork } from "./job-application-test-helpers.js";

describe("GenerateJobApplicationDocumentsUseCase", () => {
  it("rejects stale generated files and schedules their cleanup", async () => {
    const profiles = new InMemoryUserProfileRepository();
    const jobApplications = new InMemoryJobApplicationRepository();
    const profile = await profiles.create({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      skills: ["TypeScript"],
      experience: [],
    });
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
    const { unitOfWork, addOutboxEvent } = createUnitOfWork(jobApplications, profiles as never);
    const documentGeneration = {
      stage: vi.fn(async (input: { generationAttemptId: string }) => {
        await jobApplications.beginDocumentGeneration(jobApplication.id, "newer-attempt");
        return [
          {
            kind: "cv",
            format: "pdf",
            fileId: `files/${input.generationAttemptId}/cv.pdf`,
            fileName: "cv.pdf",
            contentType: "application/pdf",
          },
        ];
      }),
    };

    await expect(
      new GenerateJobApplicationDocumentsUseCase(
        jobApplications,
        profiles,
        documentGeneration as never,
        unitOfWork,
      ).execute(jobApplication.id),
    ).rejects.toThrow("superseded");

    expect(await jobApplications.listGeneratedDocuments(jobApplication.id)).toEqual([]);
    expect(addOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "storage.delete",
        payload: expect.objectContaining({ fileId: expect.stringContaining("/cv.pdf") }),
      }),
    );
    expect((await jobApplications.findById(jobApplication.id))?.status).toBe(
      "generating_documents",
    );
  });
});
