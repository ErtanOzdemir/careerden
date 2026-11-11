import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiProviderError } from "@careerden/domain";
import type { AiProvider, AiProviderErrorCategory } from "@careerden/domain";
import { aiCredentialsIpcChannels, registerAiCredentialsIpc } from "./ai-credentials-ipc.js";
import { AiCredentialsStore } from "./ai-credentials-store.js";

const encryption = {
  isEncryptionAvailable: () => true,
  encryptString: (plainText: string) => Buffer.from(plainText).reverse(),
  decryptString: (encrypted: Buffer) => Buffer.from(encrypted).reverse().toString(),
};

describe("registerAiCredentialsIpc", () => {
  let directory: string;
  let store: AiCredentialsStore;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "careerden-ai-ipc-"));
    store = new AiCredentialsStore(join(directory, "ai-credentials.bin"), encryption);
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  function register(provider?: AiProvider) {
    const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>();
    const onChanged = vi.fn();
    const logger = { warn: vi.fn() };
    const createProvider = vi.fn(() => provider ?? { generate: async () => ({ ok: true }) });
    registerAiCredentialsIpc(
      {
        register: (channel, handler) => {
          handlers.set(channel, handler);
          return undefined;
        },
      },
      store,
      { onChanged, createProvider: createProvider as never, testTimeoutMs: 1_000, logger },
    );
    // Like ipcMain.handle, report synchronous handler errors as rejections.
    const invoke = async (channel: string, ...args: unknown[]) =>
      handlers.get(channel)?.({}, ...args);
    return { invoke, onChanged, createProvider, handlers, logger };
  }

  it("registers exactly the credential channels", () => {
    const { handlers } = register();

    expect([...handlers.keys()].sort()).toEqual(Object.values(aiCredentialsIpcChannels).sort());
  });

  it("saves keys and answers with a status that never includes them", async () => {
    const { invoke, onChanged } = register();

    const status = await invoke(aiCredentialsIpcChannels.save, {
      provider: "anthropic",
      apiKey: "sk-ant-secret-9876",
    });

    expect(status).toEqual({
      encryptionAvailable: true,
      activeProvider: "anthropic",
      providers: [{ provider: "anthropic", keyHint: "9876" }],
    });
    expect(JSON.stringify(status)).not.toContain("secret");
    expect(onChanged).toHaveBeenCalledOnce();
  });

  it("rejects malformed input from the renderer", async () => {
    const { invoke } = register();

    await expect(
      invoke(aiCredentialsIpcChannels.save, { provider: "unknown", apiKey: "x" }),
    ).rejects.toThrow();
    await expect(
      invoke(aiCredentialsIpcChannels.save, { provider: "openai", apiKey: "x", extra: true }),
    ).rejects.toThrow();
    await expect(invoke(aiCredentialsIpcChannels.remove, "../openai")).rejects.toThrow();
  });

  it("tests a typed key, or the stored key for the same provider", async () => {
    const { invoke, createProvider } = register();
    await store.save({ provider: "openai", apiKey: "sk-stored-1111" });

    await expect(
      invoke(aiCredentialsIpcChannels.test, { provider: "gemini", apiKey: "gemini-typed" }),
    ).resolves.toEqual({ ok: true });
    await expect(invoke(aiCredentialsIpcChannels.test, { provider: "openai" })).resolves.toEqual({
      ok: true,
    });
    await expect(invoke(aiCredentialsIpcChannels.test, { provider: "deepseek" })).resolves.toEqual({
      ok: false,
      message: "Enter an API key to test.",
    });

    expect(createProvider.mock.calls.map(([selection]) => selection)).toEqual([
      { provider: "gemini", apiKey: "gemini-typed" },
      { provider: "openai", apiKey: "sk-stored-1111" },
    ]);
  });

  it("reports provider failures without echoing the key or long fragments of it", async () => {
    const apiKey = "sk-proj-abcdefghijklmnopqrstuvwxyz";
    const { invoke } = register({
      generate: async () => {
        throw new Error(`Incorrect API key provided: sk-proj-abcd************wxyz. ${apiKey}`);
      },
    });

    const result = (await invoke(aiCredentialsIpcChannels.test, {
      provider: "openai",
      apiKey,
    })) as { ok: false; message: string };

    expect(result.ok).toBe(false);
    expect(result.message).toContain("Incorrect API key provided");
    expect(result.message).not.toContain("sk-proj-abcd");
    expect(result.message).not.toContain(apiKey);
  });

  function failingProvider(category: AiProviderErrorCategory): AiProvider {
    return {
      generate: async () => {
        throw new AiProviderError({ category, provider: "openai", statusCode: 401 });
      },
    };
  }

  it("refuses to save a key the provider rejects", async () => {
    const { invoke, onChanged } = register(failingProvider("invalid_api_key"));

    await expect(
      invoke(aiCredentialsIpcChannels.save, { provider: "openai", apiKey: "sk-revoked-0000" }),
    ).rejects.toThrow("Your API key is invalid or revoked. Check it and enter it again.");

    expect((await store.getStatus()).providers).toEqual([]);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("writes the provider check failure to the log without the key", async () => {
    const { invoke, logger } = register(failingProvider("invalid_api_key"));

    await expect(
      invoke(aiCredentialsIpcChannels.save, { provider: "openai", apiKey: "sk-revoked-0000" }),
    ).rejects.toThrow();

    expect(logger.warn).toHaveBeenCalledWith("ai.provider_error", {
      category: "invalid_api_key",
      provider: "openai",
      statusCode: 401,
    });
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain("sk-revoked");
  });

  it("checks a model change against the stored key before saving it", async () => {
    await store.save({ provider: "openai", apiKey: "sk-stored-1111" });
    const { invoke, createProvider } = register(failingProvider("model_unavailable"));

    await expect(
      invoke(aiCredentialsIpcChannels.save, { provider: "openai", model: "gpt-removed" }),
    ).rejects.toThrow("The selected model is no longer available.");

    expect(createProvider).toHaveBeenCalledWith({
      provider: "openai",
      apiKey: "sk-stored-1111",
      model: "gpt-removed",
    });
    expect((await store.getStatus()).providers).toEqual([{ provider: "openai", keyHint: "1111" }]);
  });

  it.each(["insufficient_quota", "rate_limited", "provider_unavailable"] as const)(
    "saves the key with a warning when the check fails with %s",
    async (category) => {
      const { invoke } = register(failingProvider(category));

      const result = (await invoke(aiCredentialsIpcChannels.save, {
        provider: "openai",
        apiKey: "sk-maybe-2222",
      })) as { activeProvider: string; warning?: string };

      expect(result.activeProvider).toBe("openai");
      expect(result.warning).toMatch(/^Saved, but the provider check failed: /);
    },
  );

  it("reports the error category from a connection test", async () => {
    const { invoke } = register(failingProvider("insufficient_quota"));

    await expect(
      invoke(aiCredentialsIpcChannels.test, { provider: "openai", apiKey: "sk-empty-3333" }),
    ).resolves.toEqual({
      ok: false,
      message: "Your provider account has no balance or quota left.",
      category: "insufficient_quota",
    });
  });
});
