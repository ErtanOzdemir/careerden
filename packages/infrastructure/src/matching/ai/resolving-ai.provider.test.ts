import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
import type { AiProvider } from "@careerden/domain";
import type { AiProviderSelection } from "./ai-provider.factory.js";
import { AiProviderNotConfiguredError, ResolvingAiProvider } from "./resolving-ai.provider.js";

const params = { system: "system", prompt: "prompt", outputSchema: z.object({ ok: z.boolean() }) };

describe("ResolvingAiProvider", () => {
  it("fails with a configuration error while no provider is selected", async () => {
    const create = vi.fn();
    const provider = new ResolvingAiProvider({ current: async () => null }, create);

    await expect(provider.isConfigured()).resolves.toBe(false);
    await expect(provider.generate(params)).rejects.toBeInstanceOf(AiProviderNotConfiguredError);
    expect(create).not.toHaveBeenCalled();
  });

  it("generates with the selection current at call time", async () => {
    let selection: AiProviderSelection = { provider: "openai", apiKey: "key-1" };
    const generate = vi.fn(async () => ({ ok: true }));
    const create = vi.fn((_selection: AiProviderSelection): AiProvider => ({ generate }) as never);
    const provider = new ResolvingAiProvider({ current: async () => selection }, create);

    await expect(provider.generate(params)).resolves.toEqual({ ok: true });
    selection = { provider: "anthropic", apiKey: "key-2", model: "claude-sonnet-5-5" };
    await provider.generate(params);

    expect(create.mock.calls.map(([used]) => used)).toEqual([
      { provider: "openai", apiKey: "key-1" },
      { provider: "anthropic", apiKey: "key-2", model: "claude-sonnet-5-5" },
    ]);
    expect(generate).toHaveBeenCalledTimes(2);
  });
});
