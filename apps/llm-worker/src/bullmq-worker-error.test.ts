import { UnrecoverableError } from "bullmq";
import { describe, expect, it } from "vitest";
import { ApplicationError } from "@careerden/application";
import { AiProviderError } from "@careerden/domain";
import { toBullMqWorkerError } from "./bullmq-worker-error.js";

describe("toBullMqWorkerError", () => {
  it("makes typed application errors terminal", () => {
    const result = toBullMqWorkerError(
      new ApplicationError("validation", "Scrape data is required"),
    );

    expect(result).toBeInstanceOf(UnrecoverableError);
    expect(result).toMatchObject({ message: "[validation] Scrape data is required" });
  });

  it("keeps unexpected errors retryable", () => {
    const error = new Error("OpenAI unavailable");
    expect(toBullMqWorkerError(error)).toBe(error);
  });

  it("makes AI provider failures that retrying cannot fix terminal", () => {
    const result = toBullMqWorkerError(
      new AiProviderError({ category: "insufficient_quota", provider: "openai", statusCode: 429 }),
    );

    expect(result).toBeInstanceOf(UnrecoverableError);
    expect(result).toMatchObject({
      message:
        "[ai_provider_error:insufficient_quota] Your provider account has no balance or quota left.",
    });
  });

  it("keeps rate limits and provider outages retryable", () => {
    const rateLimited = new AiProviderError({ category: "rate_limited", provider: "gemini" });
    const unavailable = new AiProviderError({ category: "provider_unavailable" });

    expect(toBullMqWorkerError(rateLimited)).toBe(rateLimited);
    expect(toBullMqWorkerError(unavailable)).toBe(unavailable);
  });
});
