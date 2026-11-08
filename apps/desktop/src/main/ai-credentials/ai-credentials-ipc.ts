import { z } from "zod";
import { AiProviderError } from "@careerden/domain";
import type { AiProvider, AiProviderErrorCategory } from "@careerden/domain";
import { aiProviderNames, createAiProvider } from "@careerden/infrastructure";
import type { AiProviderSelection } from "@careerden/infrastructure";
import { redactKnownSecrets } from "@careerden/infrastructure/logging";
import type { AiCredentialsStatus, AiCredentialsStore } from "./ai-credentials-store.js";

export const aiCredentialsIpcChannels = {
  getStatus: "ai-credentials-get-status",
  save: "ai-credentials-save",
  remove: "ai-credentials-remove",
  setActive: "ai-credentials-set-active",
  test: "ai-credentials-test",
} as const;

const providerSchema = z.enum(aiProviderNames);
const saveInputSchema = z
  .object({
    provider: providerSchema,
    apiKey: z.string().trim().min(1).max(500).optional(),
    model: z.string().trim().max(200).optional(),
  })
  .strict();
const testInputSchema = saveInputSchema;

export type AiCredentialsTestResult =
  | { ok: true }
  | { ok: false; message: string; category?: AiProviderErrorCategory };

// A saved status, plus a note when the provider could not confirm the key but it may still work.
export type AiCredentialsSaveResult = AiCredentialsStatus & { warning?: string };

// Failures that prove the entered key or model cannot work, so saving it is refused.
const blockingSaveCategories: ReadonlySet<AiProviderErrorCategory> = new Set([
  "invalid_api_key",
  "model_unavailable",
]);

interface IpcRegistrar {
  register(channel: string, handler: (event: unknown, ...args: unknown[]) => unknown): unknown;
}

// Renderer-facing operations. None returns a stored key; the renderer only ever sends one in.
export function registerAiCredentialsIpc(
  registry: IpcRegistrar,
  store: AiCredentialsStore,
  options: {
    onChanged?: () => void;
    createProvider?: (selection: AiProviderSelection) => AiProvider;
    testTimeoutMs?: number;
  } = {},
): void {
  const changed = async (work: Promise<void>): Promise<AiCredentialsStatus> => {
    await work;
    options.onChanged?.();
    return store.getStatus();
  };

  registry.register(aiCredentialsIpcChannels.getStatus, () => store.getStatus());
  // Sends one small request before saving so a mistyped or revoked key is reported right away
  // instead of surfacing later as a failed analysis.
  registry.register(aiCredentialsIpcChannels.save, async (_event, input) => {
    const parsed = saveInputSchema.parse(input);
    const apiKey = parsed.apiKey ?? (await store.apiKeyFor(parsed.provider));
    const validation =
      apiKey && (await store.getStatus()).encryptionAvailable
        ? await testAiProvider(
            { provider: parsed.provider, apiKey, ...(parsed.model ? { model: parsed.model } : {}) },
            options.createProvider ?? createAiProvider,
            options.testTimeoutMs ?? 30_000,
          )
        : ({ ok: true } as const);
    if (!validation.ok && validation.category && blockingSaveCategories.has(validation.category)) {
      throw new Error(validation.message);
    }

    const status: AiCredentialsSaveResult = await changed(store.save(parsed));
    return validation.ok
      ? status
      : { ...status, warning: `Saved, but the provider check failed: ${validation.message}` };
  });
  registry.register(aiCredentialsIpcChannels.remove, (_event, provider) =>
    changed(store.remove(providerSchema.parse(provider))),
  );
  registry.register(aiCredentialsIpcChannels.setActive, (_event, provider) =>
    changed(store.setActive(providerSchema.parse(provider))),
  );
  registry.register(aiCredentialsIpcChannels.test, async (_event, input) => {
    const parsed = testInputSchema.parse(input);
    const stored = (await store.currentSelection()) ?? undefined;
    const apiKey =
      parsed.apiKey ?? (stored?.provider === parsed.provider ? stored.apiKey : undefined);
    if (!apiKey) return { ok: false, message: "Enter an API key to test." };

    return testAiProvider(
      { provider: parsed.provider, apiKey, ...(parsed.model ? { model: parsed.model } : {}) },
      options.createProvider ?? createAiProvider,
      options.testTimeoutMs ?? 30_000,
    );
  });
}

export async function testAiProvider(
  selection: AiProviderSelection,
  createProvider: (selection: AiProviderSelection) => AiProvider,
  timeoutMs: number,
): Promise<AiCredentialsTestResult> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      createProvider(selection).generate({
        system: "You check that an API connection works.",
        prompt: 'Reply with {"ok": true}.',
        outputSchema: z.object({ ok: z.boolean() }),
        thinking: false,
      }),
      new Promise((_resolve, reject) => {
        timeout = setTimeout(
          () =>
            reject(
              new AiProviderError(
                { category: "provider_unavailable", provider: selection.provider },
                { message: "The provider did not respond in time." },
              ),
            ),
          timeoutMs,
        );
      }),
    ]);
    return { ok: true };
  } catch (error) {
    if (error instanceof AiProviderError) {
      console.warn("AI provider check failed", {
        event: "ai.provider_error",
        ...error.toFailure(),
      });
      return { ok: false, message: error.message, category: error.category };
    }
    return { ok: false, message: redactKey(describeError(error), selection.apiKey) };
  } finally {
    clearTimeout(timeout);
  }
}

function describeError(error: unknown): string {
  const cause = (error as { cause?: unknown }).cause;
  const source = cause instanceof Error ? cause : error;
  return source instanceof Error && source.message ? source.message : "The connection test failed.";
}

// Provider errors sometimes echo part of the key back; never pass it to the renderer.
function redactKey(message: string, apiKey: string): string {
  return redactKnownSecrets(message, [apiKey]).slice(0, 500);
}
