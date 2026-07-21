import { describe, expect, it, vi } from "vitest";
import { richDocumentFromText } from "@careerden/domain";
import {
  InMemoryJobApplicationRepository,
  InMemoryUserProfileRepository,
} from "@careerden/infrastructure";
import { createUnitOfWork } from "./job-application-test-helpers.js";
import { RequestApplicationPackGenerationUseCase } from "./request-application-pack-generation.use-case.js";

describe("RequestApplicationPackGenerationUseCase", () => {
  it("atomically stores focused edits and queues an asynchronous generation", async () => {
    const profiles = new InMemoryUserProfileRepository();
    const profile = await profiles.create({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      skills: ["TypeScript"],
      experience: [],
    });
    Object.assign(profiles, { findUserIdByProfileId: vi.fn(async () => "user-1") });
    const jobApplications = new InMemoryJobApplicationRepository();
    const jobApplication = await jobApplications.create({ profileId: profile.id });
    await jobApplications.saveMatchAnalysis(jobApplication.id, analysis);
    await jobApplications.updateStatus(jobApplication.id, "review_ready");
    const { unitOfWork, addOutboxEvent, recordChanged } = createUnitOfWork(
      jobApplications,
      profiles as never,
    );
    const documentContent = {
      customizedSummary: richDocumentFromText("Reviewed summary"),
      experienceEnhancements: [],
    };

    const result = await new RequestApplicationPackGenerationUseCase(unitOfWork).execute({
      jobApplicationId: jobApplication.id,
      userId: "user-1",
      documentContent,
      preferences: { language: "tr-TR", tone: "concise" },
    });

    expect(result.generationAttemptId).toEqual(expect.any(String));
    expect(await jobApplications.findById(jobApplication.id)).toMatchObject({
      status: "generating_documents",
      documentGenerationAttemptId: result.generationAttemptId,
      applicationPackPreferences: { language: "tr-TR", tone: "concise" },
    });
    expect(await jobApplications.getDocumentContent(jobApplication.id)).toEqual(documentContent);
    expect(addOutboxEvent).toHaveBeenCalledWith({
      type: "application-pack.generation-requested",
      aggregateId: jobApplication.id,
      payload: {
        jobApplicationId: jobApplication.id,
        generationAttemptId: result.generationAttemptId,
      },
    });
    expect(recordChanged).toHaveBeenCalledWith(jobApplication.id, profile.id);
  });

  it("rejects a template that does not belong to the requested document kind", async () => {
    const profiles = new InMemoryUserProfileRepository();
    const profile = await profiles.create({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      skills: ["TypeScript"],
      experience: [],
    });
    Object.assign(profiles, { findUserIdByProfileId: vi.fn(async () => "user-1") });
    const coverTemplate = await profiles.createDocumentTemplate({
      profileId: profile.id,
      kind: "cover_letter",
      format: "docx",
      fileId: "templates/cover.docx",
      fileName: "cover.docx",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 10,
      placeholders: ["body"],
      fieldMappings: { body: "cover_letter_content" },
    });
    const jobApplications = new InMemoryJobApplicationRepository();
    const jobApplication = await jobApplications.create({ profileId: profile.id });
    await jobApplications.saveMatchAnalysis(jobApplication.id, analysis);
    await jobApplications.updateStatus(jobApplication.id, "review_ready");
    const { unitOfWork } = createUnitOfWork(jobApplications, profiles as never);

    await expect(
      new RequestApplicationPackGenerationUseCase(unitOfWork).execute({
        jobApplicationId: jobApplication.id,
        userId: "user-1",
        preferences: {
          language: "auto",
          tone: "professional",
          cvTemplateId: coverTemplate.id,
        },
      }),
    ).rejects.toMatchObject({ code: "validation" });
    expect((await jobApplications.findById(jobApplication.id))?.status).toBe("review_ready");
  });
});

const analysis = {
  matchScore: 90,
  missingSkills: [],
  strongSkills: ["TypeScript"],
  recommendedAchievements: [],
  customizedSummary: "Summary",
  interviewTips: [],
};
