import { z } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateText } from "ai";
import { GeminiAiProvider } from "./gemini-ai.provider.js";

vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  generateText: vi.fn(),
}));

const params = { system: "system", prompt: "prompt", outputSchema: z.object({ ok: z.boolean() }) };

describe("GeminiAiProvider", () => {
  beforeEach(() => {
    vi.mocked(generateText).mockReset();
    vi.mocked(generateText).mockResolvedValue({ output: { ok: true } } as never);
  });

  it("keeps the model's default thinking when not disabled", async () => {
    await new GeminiAiProvider("key").generate(params);

    expect(vi.mocked(generateText).mock.calls[0]![0]).not.toHaveProperty("providerOptions");
  });

  it("sets a zero thinking budget when thinking is disabled", async () => {
    await expect(
      new GeminiAiProvider("key").generate({ ...params, thinking: false }),
    ).resolves.toEqual({ ok: true });

    expect(vi.mocked(generateText).mock.calls[0]![0].providerOptions).toEqual({
      google: { thinkingConfig: { thinkingBudget: 0 } },
    });
  });
});
