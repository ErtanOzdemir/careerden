import { describe, expect, it, vi } from "vitest";
import { InMemoryJobApplicationRepository } from "@careerden/infrastructure";
import { AiProviderError } from "@careerden/domain";
import type { PersistenceUnitOfWork } from "@careerden/domain";
import { createCreditRepositoryDouble, createProfiles } from "./job-application-test-helpers.js";
import {
  FinalizeJobApplicationAnalysisFailureUseCase,
  analysisFailureFromError,
} from "./finalize-job-application-analysis-failure.use-case.js";

async function setup() {
  const jobApplications = new InMemoryJobApplicationRepository();
  const jobApplication = await jobApplications.create({
    profileId: "profile-1",
    sourceUrl: "https://www.linkedin.com/jobs/view/1",
  });
  await jobApplications.updateStatus(jobApplication.id, "scraped");
  await jobApplications.setAnalysisAttempt(jobApplication.id, "attempt-1");
  await jobApplications.beginAnalysis(jobApplication.id, "attempt-1");
  const credits = createCreditRepositoryDouble();
  const changed = vi.fn();
  const unitOfWork: PersistenceUnitOfWork = {
    execute: (work) =>
      work({
        billingSubscriptions: {} as never,
        credits,
        jobApplications,
        jobApplicationChanges: { changed, deleted: vi.fn() },
        profiles: createProfiles() as never,
        notifications: {} as never,
        notificationChanges: {} as never,
        followUpReminders: {} as never,
        outbox: {} as never,
      }),
  };
  return {
    jobApplications,
    jobApplication,
    credits,
    changed,
    useCase: new FinalizeJobApplicationAnalysisFailureUseCase(unitOfWork),
  };
}

describe("FinalizeJobApplicationAnalysisFailureUseCase", () => {
  it("fails the current attempt and releases its credit once", async () => {
    const { jobApplications, jobApplication, credits, changed, useCase } = await setup();

    await expect(
      useCase.execute({
        jobApplicationId: jobApplication.id,
        analysisAttemptId: "attempt-1",
        reason: "provider unavailable",
      }),
    ).resolves.toBe(true);

    expect((await jobApplications.findById(jobApplication.id))?.status).toBe("failed");
    expect(credits.releaseReservation).toHaveBeenCalledWith(
      "attempt-1",
      "failure",
      expect.any(Date),
    );
    expect(changed).toHaveBeenCalledOnce();
  });

  it("persists the AI provider failure on the application and its timeline event", async () => {
    const { jobApplications, jobApplication, useCase } = await setup();
    const error = new AiProviderError({
      category: "invalid_api_key",
      provider: "openai",
      statusCode: 401,
    });

    await useCase.execute({
      jobApplicationId: jobApplication.id,
      analysisAttemptId: "attempt-1",
      ...analysisFailureFromError(error),
    });

    const failed = await jobApplications.findById(jobApplication.id);
    expect(failed).toMatchObject({
      status: "failed",
      failureReason: "Your API key is invalid or revoked. Update it in Settings.",
      aiFailure: { category: "invalid_api_key", provider: "openai", statusCode: 401 },
    });
    const events = await jobApplications.listEvents(jobApplication.id);
    expect(events.find((event) => event.title === "AI analysis failed")).toMatchObject({
      title: "AI analysis failed",
      body: "Your API key is invalid or revoked. Update it in Settings.",
      metadata: {
        attemptId: "attempt-1",
        aiFailure: { category: "invalid_api_key", provider: "openai", statusCode: 401 },
      },
    });
  });
});

describe("analysisFailureFromError", () => {
  it("keeps only the message for errors that did not come from the AI provider", () => {
    expect(analysisFailureFromError(new Error("Profile missing"))).toEqual({
      reason: "Profile missing",
    });
    expect(analysisFailureFromError("boom")).toEqual({ reason: "Unknown AI analysis error" });
  });
});
