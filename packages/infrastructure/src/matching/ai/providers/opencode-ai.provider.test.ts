import type { OpencodeClient } from "@opencode-ai/sdk/v2";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AiOutputValidationError } from "../generate-with-output-schema.js";
import { OpencodeAiProvider } from "./opencode-ai.provider.js";

const outputSchema = z.object({ requirements: z.array(z.string()) });
const config = {
  baseUrl: "http://opencode:4096",
  username: "opencode",
  password: "secret",
  model: "deepseek-v4.1-flash-free",
  timeoutMs: 5_000,
};
const params = {
  tier: "free" as const,
  system: "Extract requirements.",
  prompt: '{"description":"Build TypeScript services"}',
  outputSchema,
};

function createClient(info: Record<string, unknown>, options: { deleteFails?: boolean } = {}) {
  const session = {
    create: vi.fn(async () => ({ data: { id: "session-1" } })),
    prompt: vi.fn(async () => ({ data: { info, parts: [] } })),
    delete: vi.fn(async () => {
      if (options.deleteFails) throw new Error("delete failed");
      return { data: true };
    }),
  };
  return { client: { session } as unknown as OpencodeClient, session };
}

describe("OpencodeAiProvider", () => {
  it("sends a structured-output prompt to a throwaway session and deletes it", async () => {
    const { client, session } = createClient({
      structured: { requirements: ["TypeScript"] },
    });

    await expect(new OpencodeAiProvider(config, client).generate(params)).resolves.toEqual({
      requirements: ["TypeScript"],
    });

    expect(session.prompt).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionID: "session-1",
        agent: "careerden",
        model: { providerID: "opencode", modelID: "deepseek-v4.1-flash-free" },
        system: "Extract requirements.",
        parts: [{ type: "text", text: params.prompt }],
        format: expect.objectContaining({
          type: "json_schema",
          retryCount: 2,
          schema: expect.objectContaining({ type: "object" }),
        }),
      }),
      expect.objectContaining({ throwOnError: true }),
    );
    expect(session.delete).toHaveBeenCalledWith(
      { sessionID: "session-1" },
      expect.objectContaining({ throwOnError: true }),
    );
  });

  it("maps a structured-output failure to an output validation error and still deletes", async () => {
    const { client, session } = createClient({
      error: { name: "StructuredOutputError", data: { message: "no valid JSON", retries: 2 } },
    });

    await expect(new OpencodeAiProvider(config, client).generate(params)).rejects.toBeInstanceOf(
      AiOutputValidationError,
    );
    expect(session.delete).toHaveBeenCalledOnce();
  });

  it("rejects output that fails the schema", async () => {
    const { client } = createClient({ structured: { requirements: "TypeScript" } });

    await expect(new OpencodeAiProvider(config, client).generate(params)).rejects.toBeInstanceOf(
      AiOutputValidationError,
    );
  });

  it("surfaces provider errors without letting cleanup failures replace them", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { client, session } = createClient(
      { error: { name: "APIError", data: { message: "rate limited" } } },
      { deleteFails: true },
    );

    await expect(new OpencodeAiProvider(config, client).generate(params)).rejects.toThrow(
      "OpenCode APIError: rate limited",
    );
    expect(session.delete).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("deletes the session when the prompt request itself fails", async () => {
    const { client, session } = createClient({});
    session.prompt.mockRejectedValueOnce(new Error("socket hang up"));

    await expect(new OpencodeAiProvider(config, client).generate(params)).rejects.toThrow(
      "socket hang up",
    );
    expect(session.delete).toHaveBeenCalledOnce();
  });
});
