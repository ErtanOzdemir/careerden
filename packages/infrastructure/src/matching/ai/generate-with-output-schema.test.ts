import { z } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiProviderError } from "@careerden/domain";
import { APICallError, generateText } from "ai";
import { createAiProvider, type AiProviderName } from "./ai-provider.factory.js";

vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  generateText: vi.fn(),
}));

const params = { system: "system", prompt: "prompt", outputSchema: z.object({ ok: z.boolean() }) };
const providers: AiProviderName[] = ["openai", "gemini", "deepseek", "anthropic", "openrouter"];

describe("generateWithOutputSchema through each provider", () => {
  beforeEach(() => {
    vi.mocked(generateText).mockReset();
  });

  it.each(providers)("reports a rejected %s key as invalid_api_key", async (provider) => {
    vi.mocked(generateText).mockRejectedValue(
      new APICallError({
        message: "Unauthorized",
        url: "https://provider.example",
        requestBodyValues: { prompt: "prompt" },
        statusCode: 401,
        responseBody: "{}",
      }),
    );

    const failure = await createAiProvider({ provider, apiKey: "key" })
      .generate(params)
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(AiProviderError);
    expect((failure as AiProviderError).toFailure()).toEqual({
      category: "invalid_api_key",
      provider,
      statusCode: 401,
    });
  });

  it.each(providers)(
    "reports %s output that fails the schema as invalid_output",
    async (provider) => {
      vi.mocked(generateText).mockResolvedValue({ output: { ok: "yes" } } as never);

      await expect(
        createAiProvider({ provider, apiKey: "key" }).generate(params),
      ).rejects.toMatchObject({ category: "invalid_output", provider });
    },
  );

  it("lets errors that did not come from the provider through unchanged", async () => {
    const bug = new Error("bug");
    vi.mocked(generateText).mockRejectedValue(bug);

    await expect(
      createAiProvider({ provider: "openai", apiKey: "key" }).generate(params),
    ).rejects.toBe(bug);
  });
});
