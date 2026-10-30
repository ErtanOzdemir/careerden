import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiCredentialsStore, type SecretEncryption } from "./ai-credentials-store.js";

// Stand-in for safeStorage: reversible, but the file never contains the key in plain text.
function createEncryption(available = true): SecretEncryption {
  return {
    isEncryptionAvailable: () => available,
    encryptString: (plainText) => Buffer.from(Buffer.from(plainText).toString("base64")).reverse(),
    decryptString: (encrypted) =>
      Buffer.from(Buffer.from(encrypted).reverse().toString(), "base64").toString(),
  };
}

describe("AiCredentialsStore", () => {
  let directory: string;
  let filePath: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "careerden-ai-credentials-"));
    filePath = join(directory, "ai-credentials.bin");
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(directory, { recursive: true, force: true });
  });

  it("starts without credentials", async () => {
    const store = new AiCredentialsStore(filePath, createEncryption());

    await expect(store.getStatus()).resolves.toEqual({
      encryptionAvailable: true,
      activeProvider: null,
      providers: [],
    });
    await expect(store.currentSelection()).resolves.toBeNull();
  });

  it("saves an encrypted key, activates it, and reports only a hint", async () => {
    const store = new AiCredentialsStore(filePath, createEncryption());

    await store.save({ provider: "anthropic", apiKey: " sk-ant-secret-1234 ", model: "claude" });

    await expect(store.getStatus()).resolves.toEqual({
      encryptionAvailable: true,
      activeProvider: "anthropic",
      providers: [{ provider: "anthropic", model: "claude", keyHint: "1234" }],
    });
    await expect(store.currentSelection()).resolves.toEqual({
      provider: "anthropic",
      apiKey: "sk-ant-secret-1234",
      model: "claude",
    });
    expect((await readFile(filePath)).toString()).not.toContain("sk-ant-secret-1234");
    expect((await stat(filePath)).mode & 0o777).toBe(0o600);
  });

  it("persists across instances and keeps the key when only the model changes", async () => {
    await new AiCredentialsStore(filePath, createEncryption()).save({
      provider: "openai",
      apiKey: "sk-openai-5678",
    });
    const reopened = new AiCredentialsStore(filePath, createEncryption());

    await reopened.save({ provider: "openai", model: "gpt-4.1" });

    await expect(reopened.currentSelection()).resolves.toEqual({
      provider: "openai",
      apiKey: "sk-openai-5678",
      model: "gpt-4.1",
    });
  });

  it("switches and removes providers, falling back to another saved key", async () => {
    const store = new AiCredentialsStore(filePath, createEncryption());
    await store.save({ provider: "openai", apiKey: "sk-openai-1111" });
    await store.save({ provider: "gemini", apiKey: "gemini-2222" });

    await store.setActive("openai");
    expect((await store.getStatus()).activeProvider).toBe("openai");
    await store.remove("openai");

    await expect(store.getStatus()).resolves.toMatchObject({
      activeProvider: "gemini",
      providers: [{ provider: "gemini", keyHint: "2222" }],
    });
    await store.remove("gemini");
    await expect(store.currentSelection()).resolves.toBeNull();
  });

  it("rejects activating or saving a provider without a key", async () => {
    const store = new AiCredentialsStore(filePath, createEncryption());

    await expect(store.setActive("deepseek")).rejects.toThrow("Add an API key for deepseek first");
    await expect(store.save({ provider: "deepseek", model: "deepseek-chat" })).rejects.toThrow(
      "Add an API key for deepseek first",
    );
  });

  it("refuses to save keys when secure storage is unavailable", async () => {
    const store = new AiCredentialsStore(filePath, createEncryption(false));

    await expect(store.save({ provider: "openai", apiKey: "sk-openai" })).rejects.toThrow(
      /Secure storage is not available/,
    );
    await expect(store.getStatus()).resolves.toMatchObject({ encryptionAvailable: false });
  });

  it("starts empty when the stored file cannot be decrypted", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await writeFile(filePath, "not encrypted by this keychain");

    await expect(
      new AiCredentialsStore(filePath, createEncryption()).currentSelection(),
    ).resolves.toBeNull();
  });
});
