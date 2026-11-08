import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { categorizeAiError, LoggingAiProvider } from "./logging-ai.provider.js";

const params = {
  system: "system prompt with profile",
  prompt: "prompt with job posting text",
  outputSchema: z.object({ ok: z.boolean() }),
};

describe("LoggingAiProvider", () => {
  it("passes results through without logging", async () => {
    const log = vi.fn();
    const provider = new LoggingAiProvider(
      { generate: async () => ({ ok: true }) as never },
      "openai",
      log,
    );

    await expect(provider.generate(params)).resolves.toEqual({ ok: true });
    expect(log).not.toHaveBeenCalled();
  });

  it("logs the provider, category, and status code of a failure without the prompt", async () => {
    const log = vi.fn();
    const failure = Object.assign(new Error("Incorrect API key"), {
      name: "AI_APICallError",
      statusCode: 401,
    });
    const provider = new LoggingAiProvider(
      {
        generate: async () => {
          throw failure;
        },
      },
      "anthropic",
      log,
    );

    await expect(provider.generate(params)).rejects.toBe(failure);
    expect(log).toHaveBeenCalledWith({
      level: "error",
      event: "ai.request_failed",
      fields: expect.objectContaining({
        provider: "anthropic",
        category: "authentication",
        statusCode: 401,
        errorName: "AI_APICallError",
      }),
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("job posting text");
  });
});

describe("categorizeAiError", () => {
  it.each([
    ["AI_APICallError", 429, "rate_limit"],
    ["AI_APICallError", 503, "provider_unavailable"],
    ["AI_APICallError", 400, "invalid_request"],
    ["AiOutputValidationError", undefined, "invalid_output"],
    ["TimeoutError", undefined, "timeout"],
    ["Error", undefined, "unknown"],
  ])("maps %s with status %s to %s", (name, status, category) => {
    expect(categorizeAiError(name, status)).toBe(category);
  });
});
