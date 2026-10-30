import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiProvider } from "@careerden/domain";
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
    const createProvider = vi.fn(() => provider ?? { generate: async () => ({ ok: true }) });
    registerAiCredentialsIpc(
      {
        register: (channel, handler) => {
          handlers.set(channel, handler);
          return undefined;
        },
      },
      store,
      { onChanged, createProvider: createProvider as never, testTimeoutMs: 1_000 },
    );
    // Like ipcMain.handle, report synchronous handler errors as rejections.
    const invoke = async (channel: string, ...args: unknown[]) =>
      handlers.get(channel)?.({}, ...args);
    return { invoke, onChanged, createProvider, handlers };
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
    await invoke(aiCredentialsIpcChannels.save, { provider: "openai", apiKey: "sk-stored-1111" });

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
});
