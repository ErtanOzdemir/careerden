import { z } from "zod";
import { APICallError } from "ai";
import { describe, expect, it, vi } from "vitest";
import type { AiGenerateParams, AiProvider } from "@careerden/domain";
import { toAiProviderError } from "./to-ai-provider-error.js";
import { ModelFallbackAiProvider } from "./model-fallback-ai.provider.js";

const params = { system: "system", prompt: "prompt", outputSchema: z.object({ ok: z.boolean() }) };

function retiredModelError(model: string): APICallError {
  return new APICallError({
    message: `The model \`${model}\` has been deprecated`,
    url: "https://api.openai.com/v1/chat/completions",
    requestBodyValues: {},
    statusCode: 404,
    responseBody: JSON.stringify({ error: { code: "model_not_found" } }),
  });
}

function fakeProviders(behavior: Record<string, () => Promise<unknown>>) {
  const generate = vi.fn();
  const createForModel = vi.fn(
    (model: string): AiProvider => ({
      generate: async <T>(request: AiGenerateParams<T>) => {
        generate(model, request);
        return (await behavior[model]!()) as T;
      },
    }),
  );
  return { createForModel, generate };
}

describe("ModelFallbackAiProvider", () => {
  it("generates with the first model and reports it", async () => {
    const { createForModel } = fakeProviders({ "gpt-4.1-mini": async () => ({ ok: true }) });
    const onModelUsed = vi.fn();
    const provider = new ModelFallbackAiProvider(
      "openai",
      ["gpt-4.1-mini", "gpt-4o-mini"],
      createForModel,
    );

    await expect(provider.generate({ ...params, onModelUsed })).resolves.toEqual({ ok: true });
    expect(createForModel).toHaveBeenCalledOnce();
    expect(onModelUsed).toHaveBeenCalledWith({ provider: "openai", model: "gpt-4.1-mini" });
  });

  it("completes on the fallback model when the configured model is retired", async () => {
    const { createForModel, generate } = fakeProviders({
      "gpt-retired": async () => {
        // Careerden's generation path translates every provider error to an AiProviderError.
        throw toAiProviderError(retiredModelError("gpt-retired"), "openai");
      },
      "gpt-4o-mini": async () => ({ ok: true }),
    });
    const logger = { warn: vi.fn() };
    const onModelUsed = vi.fn();
    const provider = new ModelFallbackAiProvider(
      "openai",
      ["gpt-retired", "gpt-4o-mini"],
      createForModel,
      logger,
    );

    await expect(provider.generate({ ...params, onModelUsed })).resolves.toEqual({ ok: true });
    expect(generate.mock.calls.map(([model]) => model)).toEqual(["gpt-retired", "gpt-4o-mini"]);
    expect(onModelUsed).toHaveBeenCalledOnce();
    expect(onModelUsed).toHaveBeenCalledWith({ provider: "openai", model: "gpt-4o-mini" });
    expect(logger.warn).toHaveBeenCalledWith(
      "AI model is unavailable; retrying with the fallback model",
      { provider: "openai", model: "gpt-retired", fallbackModel: "gpt-4o-mini" },
    );
  });

  it("retries only once even when more fallbacks are configured", async () => {
    const { createForModel } = fakeProviders({
      a: async () => Promise.reject(retiredModelError("a")),
      b: async () => Promise.reject(retiredModelError("b")),
      c: async () => ({ ok: true }),
    });
    const provider = new ModelFallbackAiProvider("openai", ["a", "b", "c"], createForModel, {
      warn: vi.fn(),
    });

    await expect(provider.generate(params)).rejects.toBeInstanceOf(APICallError);
    expect(createForModel.mock.calls.map(([model]) => model)).toEqual(["a", "b"]);
  });

  it("does not switch models for other provider errors", async () => {
    const unauthorized = new APICallError({
      message: "Incorrect API key provided",
      url: "https://api.openai.com/v1/chat/completions",
      requestBodyValues: {},
      statusCode: 401,
    });
    const { createForModel } = fakeProviders({
      a: async () => Promise.reject(unauthorized),
      b: async () => ({ ok: true }),
    });
    const provider = new ModelFallbackAiProvider("openai", ["a", "b"], createForModel);

    await expect(provider.generate(params)).rejects.toBe(unauthorized);
    expect(createForModel).toHaveBeenCalledOnce();
  });

  it("does not switch models for a rejected key reported as an AiProviderError", async () => {
    const unauthorized = toAiProviderError(
      new APICallError({
        message: "Incorrect API key provided",
        url: "https://api.openai.com/v1/chat/completions",
        requestBodyValues: {},
        statusCode: 401,
      }),
      "openai",
    );
    const { createForModel } = fakeProviders({
      a: async () => Promise.reject(unauthorized),
      b: async () => ({ ok: true }),
    });
    const provider = new ModelFallbackAiProvider("openai", ["a", "b"], createForModel);

    await expect(provider.generate(params)).rejects.toMatchObject({ category: "invalid_api_key" });
    expect(createForModel).toHaveBeenCalledOnce();
  });

  it("fails with the original error when there is no fallback model", async () => {
    const retired = retiredModelError("deepseek-chat");
    const { createForModel } = fakeProviders({
      "deepseek-chat": async () => Promise.reject(retired),
    });
    const provider = new ModelFallbackAiProvider("deepseek", ["deepseek-chat"], createForModel);

    await expect(provider.generate(params)).rejects.toBe(retired);
  });

  it("does not pass the model callback on to the single-model provider", async () => {
    const { createForModel, generate } = fakeProviders({ a: async () => ({ ok: true }) });

    await new ModelFallbackAiProvider("openai", ["a"], createForModel).generate({
      ...params,
      onModelUsed: vi.fn(),
    });

    expect(generate.mock.calls[0]![1]).not.toHaveProperty("onModelUsed");
  });
});
