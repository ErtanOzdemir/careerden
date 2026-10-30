import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import { aiProviderNames } from "@careerden/infrastructure";
import type { AiProviderName, AiProviderSelection } from "@careerden/infrastructure";

export interface SecretEncryption {
  isEncryptionAvailable(): boolean;
  encryptString(plainText: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

export interface AiProviderCredentialStatus {
  provider: AiProviderName;
  model?: string;
  // Last four characters only, so the user can tell keys apart without exposing them.
  keyHint: string;
}

export interface AiCredentialsStatus {
  encryptionAvailable: boolean;
  activeProvider: AiProviderName | null;
  providers: AiProviderCredentialStatus[];
}

const storedCredentialsSchema = z.object({
  activeProvider: z.enum(aiProviderNames).nullable(),
  providers: z.record(
    z.enum(aiProviderNames),
    z.object({ apiKey: z.string().min(1), model: z.string().min(1).optional() }),
  ),
});

type StoredCredentials = z.infer<typeof storedCredentialsSchema>;

const emptyCredentials: StoredCredentials = { activeProvider: null, providers: {} };

// Keeps the user's AI provider keys encrypted with the operating system's credential store
// (Keychain, DPAPI, or the Linux secret service). Keys never leave the main process except as the
// active selection handed to the local backend for a single AI call.
export class AiCredentialsStore {
  private cache: StoredCredentials | undefined;
  private writes: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly filePath: string,
    private readonly encryption: SecretEncryption,
  ) {}

  async getStatus(): Promise<AiCredentialsStatus> {
    const credentials = await this.read();

    return {
      encryptionAvailable: this.encryption.isEncryptionAvailable(),
      activeProvider: credentials.activeProvider,
      providers: aiProviderNames.flatMap((provider) => {
        const entry = credentials.providers[provider];
        if (!entry) return [];
        return [
          {
            provider,
            ...(entry.model ? { model: entry.model } : {}),
            keyHint: entry.apiKey.slice(-4),
          },
        ];
      }),
    };
  }

  async currentSelection(): Promise<AiProviderSelection | null> {
    const credentials = await this.read();
    const provider = credentials.activeProvider;
    const entry = provider ? credentials.providers[provider] : undefined;
    if (!provider || !entry) return null;

    return { provider, apiKey: entry.apiKey, ...(entry.model ? { model: entry.model } : {}) };
  }

  // Saves a key or model for a provider and makes it active. Omitting apiKey keeps the stored key.
  async save(input: { provider: AiProviderName; apiKey?: string; model?: string }): Promise<void> {
    await this.update((credentials) => {
      const existing = credentials.providers[input.provider];
      const apiKey = input.apiKey?.trim() || existing?.apiKey;
      if (!apiKey) throw new Error(`Add an API key for ${input.provider} first`);
      const model = input.model?.trim();

      return {
        activeProvider: input.provider,
        providers: {
          ...credentials.providers,
          [input.provider]: { apiKey, ...(model ? { model } : {}) },
        },
      };
    });
  }

  async remove(provider: AiProviderName): Promise<void> {
    await this.update((credentials) => {
      const providers = { ...credentials.providers };
      delete providers[provider];
      const remaining = aiProviderNames.filter((name) => providers[name]);

      return {
        activeProvider:
          credentials.activeProvider === provider
            ? (remaining[0] ?? null)
            : credentials.activeProvider,
        providers,
      };
    });
  }

  async setActive(provider: AiProviderName): Promise<void> {
    await this.update((credentials) => {
      if (!credentials.providers[provider]) {
        throw new Error(`Add an API key for ${provider} first`);
      }
      return { ...credentials, activeProvider: provider };
    });
  }

  private update(change: (credentials: StoredCredentials) => StoredCredentials): Promise<void> {
    const write = this.writes.then(async () => {
      if (!this.encryption.isEncryptionAvailable()) {
        throw new Error(
          "Secure storage is not available on this system, so API keys cannot be saved.",
        );
      }
      const next = storedCredentialsSchema.parse(change(await this.read()));
      await writeAtomically(this.filePath, this.encryption.encryptString(JSON.stringify(next)));
      this.cache = next;
    });
    this.writes = write.catch(() => undefined);
    return write;
  }

  private async read(): Promise<StoredCredentials> {
    if (this.cache) return this.cache;

    let encrypted: Buffer;
    try {
      encrypted = await readFile(this.filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyCredentials;
      throw error;
    }

    try {
      this.cache = storedCredentialsSchema.parse(
        JSON.parse(this.encryption.decryptString(encrypted)),
      );
    } catch (error) {
      // Unreadable after an OS keychain reset or a corrupted write; the user re-enters the key.
      console.error("Could not read stored AI credentials; starting without them", error);
      this.cache = emptyCredentials;
    }
    return this.cache;
  }
}

async function writeAtomically(path: string, data: Buffer): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${randomUUID()}.tmp`;

  try {
    await writeFile(temporaryPath, data, { mode: 0o600 });
    await rename(temporaryPath, path);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}
