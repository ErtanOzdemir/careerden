import { describe, expect, it, vi } from "vitest";
import { enqueueMatchAnalysisIfEnabled } from "./enqueue-match-analysis.js";
import { createCreditRepositoryDouble } from "@careerden/application/testing";

describe("enqueueMatchAnalysisIfEnabled", () => {
  it("pauses automatic analysis when the profile is blocked", async () => {
    const addEvent = vi.fn();
    const addOutbox = vi.fn();

    await expect(
      enqueueMatchAnalysisIfEnabled({
        credits: createCreditRepositoryDouble(),
        jobApplications: {
          addEvent,
          setAnalysisAttempt: vi.fn(async () => true),
          clearAnalysisAttempt: vi.fn(async () => true),
        },
        outbox: { add: addOutbox },
        userId: "user-1",
        jobApplicationId: "job-1",
        autoRunMatchAnalysis: true,
        insufficientCreditBehavior: "skip",
        profileReadiness: {
          state: "blocked",
          warnings: ["positioning", "skills", "evidence"],
        },
      }),
    ).resolves.toBe(false);

    expect(addOutbox).not.toHaveBeenCalled();
    expect(addEvent).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Profile action required" }),
    );
  });

  it("preserves an automatic scrape and clears the attempt when credits are unavailable", async () => {
    const credits = createCreditRepositoryDouble();
    credits.reserve.mockResolvedValue({ reserved: false, availableCredits: 0 });
    const addEvent = vi.fn();
    const clearAnalysisAttempt = vi.fn(async () => true);
    const addOutbox = vi.fn();

    await expect(
      enqueueMatchAnalysisIfEnabled({
        credits,
        jobApplications: {
          addEvent,
          setAnalysisAttempt: vi.fn(async () => true),
          clearAnalysisAttempt,
        },
        outbox: { add: addOutbox },
        userId: "user-1",
        jobApplicationId: "job-1",
        autoRunMatchAnalysis: true,
        insufficientCreditBehavior: "skip",
        createAttemptId: () => "attempt-1",
      }),
    ).resolves.toBe(false);

    expect(clearAnalysisAttempt).toHaveBeenCalledWith("job-1", "attempt-1");
    expect(addOutbox).not.toHaveBeenCalled();
    expect(addEvent).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { reason: "insufficient_credits" } }),
    );
  });

  it("returns a coded payment-required error for an explicit request", async () => {
    const credits = createCreditRepositoryDouble();
    credits.reserve.mockResolvedValue({ reserved: false, availableCredits: 0 });

    await expect(
      enqueueMatchAnalysisIfEnabled({
        credits,
        jobApplications: {
          addEvent: vi.fn(),
          setAnalysisAttempt: vi.fn(async () => true),
          clearAnalysisAttempt: vi.fn(async () => true),
        },
        outbox: { add: vi.fn() },
        userId: "user-1",
        jobApplicationId: "job-1",
        autoRunMatchAnalysis: true,
        insufficientCreditBehavior: "throw",
        createAttemptId: () => "attempt-1",
      }),
    ).rejects.toMatchObject({
      code: "payment_required",
      details: { requiredCredits: 1, availableCredits: 0 },
    });
  });
});
