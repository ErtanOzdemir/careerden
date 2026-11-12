import { describe, expect, it, vi } from "vitest";
import {
  InMemoryJobApplicationRepository,
  InMemoryUserProfileRepository,
} from "@careerden/infrastructure";
import { GenerateJobApplicationDocumentsUseCase } from "./generate-job-application-documents.use-case.js";
import { createUnitOfWork } from "@careerden/application/testing";

describe("GenerateJobApplicationDocumentsUseCase", () => {
  it("regenerates documents after a previous generation failure", async () => {
    const profiles = new InMemoryUserProfileRepository();
    const jobApplications = new InMemoryJobApplicationRepository();
    const profile = await profiles.create({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      skillGroups: [{ name: "", skills: ["TypeScript"] }],
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
    await jobApplications.updateStatus(jobApplication.id, "failed", "DOCX rendering failed");
    const { unitOfWork } = createUnitOfWork(jobApplications, profiles as never);
    const documentGeneration = {
      stage: vi.fn(async () => [
        {
          kind: "cover_letter",
          format: "docx",
          fileId: "files/attempt-2/cover-letter.docx",
          fileName: "cover-letter.docx",
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
      ]),
    };

    const documents = await new GenerateJobApplicationDocumentsUseCase(
      jobApplications,
      profiles,
      documentGeneration as never,
      unitOfWork,
    ).execute(jobApplication.id);

    expect(documents).toMatchObject([
      { kind: "cover_letter", format: "docx", fileName: "cover-letter.docx" },
    ]);
    expect(await jobApplications.findById(jobApplication.id)).toMatchObject({
      status: "completed",
      failureReason: undefined,
    });
  });

  it("allows another regeneration attempt after rendering fails again", async () => {
    const profiles = new InMemoryUserProfileRepository();
    const jobApplications = new InMemoryJobApplicationRepository();
    const profile = await profiles.create({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      skillGroups: [{ name: "", skills: ["TypeScript"] }],
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
    const { unitOfWork } = createUnitOfWork(jobApplications, profiles as never);
    const documentGeneration = {
      stage: vi
        .fn()
        .mockRejectedValueOnce(new Error("DOCX rendering failed again"))
        .mockResolvedValueOnce([]),
    };
    const useCase = new GenerateJobApplicationDocumentsUseCase(
      jobApplications,
      profiles,
      documentGeneration as never,
      unitOfWork,
    );

    await expect(useCase.execute(jobApplication.id)).rejects.toThrow("DOCX rendering failed again");
    expect(await jobApplications.findById(jobApplication.id)).toMatchObject({
      status: "failed",
      failureReason: "DOCX rendering failed again",
    });

    await expect(useCase.execute(jobApplication.id)).resolves.toEqual([]);
    expect(await jobApplications.findById(jobApplication.id)).toMatchObject({
      status: "completed",
      failureReason: undefined,
    });
  });

  it("rejects stale generated files and schedules their cleanup", async () => {
    const profiles = new InMemoryUserProfileRepository();
    const jobApplications = new InMemoryJobApplicationRepository();
    const profile = await profiles.create({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      skillGroups: [{ name: "", skills: ["TypeScript"] }],
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
