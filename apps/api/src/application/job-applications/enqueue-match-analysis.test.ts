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

  it("skips automatic analysis without reserving credits when no AI provider is configured", async () => {
    const credits = createCreditRepositoryDouble();
    const addEvent = vi.fn();
    const setAnalysisAttempt = vi.fn(async () => true);
    const addOutbox = vi.fn();

    await expect(
      enqueueMatchAnalysisIfEnabled({
        credits,
        jobApplications: { addEvent, setAnalysisAttempt, clearAnalysisAttempt: vi.fn() },
        outbox: { add: addOutbox },
        userId: "user-1",
        jobApplicationId: "job-1",
        autoRunMatchAnalysis: true,
        insufficientCreditBehavior: "skip",
        aiAvailability: { isConfigured: async () => false },
      }),
    ).resolves.toBe(false);

    expect(setAnalysisAttempt).not.toHaveBeenCalled();
    expect(credits.reserve).not.toHaveBeenCalled();
    expect(addOutbox).not.toHaveBeenCalled();
    expect(addEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "AI analysis skipped",
        metadata: { reason: "ai_provider_not_configured" },
      }),
    );
  });

  it("rejects an explicit analysis request when no AI provider is configured", async () => {
    await expect(
      enqueueMatchAnalysisIfEnabled({
        credits: createCreditRepositoryDouble(),
        jobApplications: {
          addEvent: vi.fn(),
          setAnalysisAttempt: vi.fn(async () => true),
          clearAnalysisAttempt: vi.fn(),
        },
        outbox: { add: vi.fn() },
        userId: "user-1",
        jobApplicationId: "job-1",
        autoRunMatchAnalysis: true,
        insufficientCreditBehavior: "throw",
        aiAvailability: { isConfigured: async () => false },
      }),
    ).rejects.toMatchObject({ code: "ai_provider_not_configured" });
  });

  it("queues analysis when the AI provider is configured", async () => {
    const addOutbox = vi.fn();

    await expect(
      enqueueMatchAnalysisIfEnabled({
        credits: createCreditRepositoryDouble(),
        jobApplications: {
          addEvent: vi.fn(),
          setAnalysisAttempt: vi.fn(async () => true),
          clearAnalysisAttempt: vi.fn(),
        },
        outbox: { add: addOutbox },
        userId: "user-1",
        jobApplicationId: "job-1",
        autoRunMatchAnalysis: true,
        insufficientCreditBehavior: "throw",
        aiAvailability: { isConfigured: async () => true },
        createAttemptId: () => "attempt-1",
      }),
    ).resolves.toBe(true);

    expect(addOutbox).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { jobApplicationId: "job-1", analysisAttemptId: "attempt-1" },
      }),
    );
  });
});
