import type { AiProvider } from "@careerden/domain";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { TieredAiProvider } from "./tiered-ai.provider.js";

function createProvider(output: string): AiProvider {
  return { generate: vi.fn(async () => output) } as unknown as AiProvider;
}

describe("TieredAiProvider", () => {
  it("routes each request to its tier's provider", async () => {
    const free = createProvider("free");
    const premium = createProvider("premium");
    const provider = new TieredAiProvider({ free, premium });
    const base = { system: "s", prompt: "p", outputSchema: z.string() };

    await expect(provider.generate({ ...base, tier: "free" })).resolves.toBe("free");
    await expect(provider.generate({ ...base, tier: "premium" })).resolves.toBe("premium");
    expect(free.generate).toHaveBeenCalledOnce();
    expect(premium.generate).toHaveBeenCalledOnce();
  });

  it("does not fall back to the premium provider when the free provider fails", async () => {
    const free = { generate: vi.fn(async () => Promise.reject(new Error("rate limited"))) };
    const premium = createProvider("premium");
    const provider = new TieredAiProvider({ free: free as unknown as AiProvider, premium });

    await expect(
      provider.generate({ tier: "free", system: "s", prompt: "p", outputSchema: z.string() }),
    ).rejects.toThrow("rate limited");
    expect(premium.generate).not.toHaveBeenCalled();
  });
});
