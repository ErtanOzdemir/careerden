import { z } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateText } from "ai";
import { OpenAiAiProvider } from "./openai-ai.provider.js";

vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  generateText: vi.fn(),
}));

const params = { system: "system", prompt: "prompt", outputSchema: z.object({ ok: z.boolean() }) };

describe("OpenAiAiProvider", () => {
  beforeEach(() => {
    vi.mocked(generateText).mockReset();
    vi.mocked(generateText).mockResolvedValue({ output: { ok: true } } as never);
  });

  it("keeps structured outputs non-strict so schemas may have optional fields", async () => {
    await expect(new OpenAiAiProvider("key", "gpt-4.1-mini").generate(params)).resolves.toEqual({
      ok: true,
    });

    expect(vi.mocked(generateText).mock.calls[0]![0].providerOptions).toEqual({
      openai: { strictJsonSchema: false },
    });
  });
});
