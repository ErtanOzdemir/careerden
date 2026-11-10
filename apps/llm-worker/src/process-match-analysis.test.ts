import { UnrecoverableError } from "bullmq";
import { ApplicationError } from "@careerden/application";
import { AiProviderError } from "@careerden/domain";
import { afterEach, describe, expect, it, vi } from "vitest";
import { processMatchAnalysis } from "./process-match-analysis.js";

const payload = { jobApplicationId: "job-1", analysisAttemptId: "attempt-1" };

function run(failure: unknown, attemptsMade = 0) {
  const finalizeFailure = { execute: vi.fn(async () => true) };
  const result = processMatchAnalysis({
    payload,
    attemptsMade,
    maximumAttempts: 3,
    analyze: { execute: vi.fn(async () => Promise.reject(failure)) },
    finalizeFailure,
  });
  return { result, finalizeFailure };
}

describe("processMatchAnalysis", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("completes without finalizing a failure", async () => {
    const finalizeFailure = { execute: vi.fn() };

    await processMatchAnalysis({
      payload,
      attemptsMade: 0,
      maximumAttempts: 3,
      analyze: { execute: vi.fn(async () => undefined) },
      finalizeFailure,
    });

    expect(finalizeFailure.execute).not.toHaveBeenCalled();
  });

  it("leaves transient failures analyzing while BullMQ still has retries", async () => {
    const failure = new Error("database unavailable");
    const { result, finalizeFailure } = run(failure);

    await expect(result).rejects.toBe(failure);
    expect(finalizeFailure.execute).not.toHaveBeenCalled();
  });

  it("finalizes the failure after the final retry", async () => {
    const failure = new Error("database unavailable");
    const { result, finalizeFailure } = run(failure, 2);

    await expect(result).rejects.toBe(failure);
    expect(finalizeFailure.execute).toHaveBeenCalledWith({
      ...payload,
      reason: "database unavailable",
    });
  });

  it("finalizes application errors immediately and makes them unrecoverable", async () => {
    const { result, finalizeFailure } = run(new ApplicationError("validation", "No scrape data"));

    await expect(result).rejects.toBeInstanceOf(UnrecoverableError);
    expect(finalizeFailure.execute).toHaveBeenCalledWith({ ...payload, reason: "No scrape data" });
  });

  it("persists the category of AI provider failures that retrying cannot fix", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const failure = new AiProviderError({ category: "invalid_api_key", provider: "openai" });
    const { result, finalizeFailure } = run(failure);

    await expect(result).rejects.toBeInstanceOf(UnrecoverableError);
    expect(finalizeFailure.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        ...payload,
        aiFailure: expect.objectContaining({ category: "invalid_api_key", provider: "openai" }),
      }),
    );
  });

  it("logs only safe AI provider failure fields and keeps rate limits retryable", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const failure = new AiProviderError({
      category: "rate_limited",
      provider: "gemini",
      statusCode: 429,
    });
    const { result, finalizeFailure } = run(failure);

    await expect(result).rejects.toBe(failure);
    expect(finalizeFailure.execute).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("LLM worker AI provider call failed", {
      event: "ai.provider_error",
      jobApplicationId: "job-1",
      category: "rate_limited",
      provider: "gemini",
      statusCode: 429,
      retryable: true,
    });
  });
});
