import { describe, expect, it, vi } from "vitest";
import { InMemoryJobApplicationRepository } from "@careerden/infrastructure";
import type { PersistenceUnitOfWork } from "@careerden/domain";
import { createCreditRepositoryDouble, createProfiles } from "@careerden/application/testing";
import { FinalizeJobApplicationAnalysisFailureUseCase } from "./finalize-job-application-analysis-failure.use-case.js";

describe("FinalizeJobApplicationAnalysisFailureUseCase", () => {
  it("fails the current attempt and releases its credit once", async () => {
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
    const useCase = new FinalizeJobApplicationAnalysisFailureUseCase(unitOfWork);

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
});
