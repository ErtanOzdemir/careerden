import { randomBytes, randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const encryptionKeyBytes = 32;
const keyFileName = "linkedin-session-key.safe-storage";
const secureLinuxBackends = new Set(["gnome_libsecret", "kwallet", "kwallet5", "kwallet6"]);

export interface SafeStorageKeyProtector {
  decryptString(encrypted: Buffer): string;
  encryptString(plainText: string): Buffer;
  getSelectedStorageBackend?(): string;
  isEncryptionAvailable(): boolean;
}

export class LinkedInSessionKeyStore {
  constructor(
    private readonly storageDirectory: string,
    private readonly protector: SafeStorageKeyProtector,
    private readonly options: {
      platform?: NodeJS.Platform;
      randomKey?: () => Buffer;
    } = {},
  ) {}

  async getOrCreateKey(): Promise<Buffer> {
    this.ensureSafeStorageAvailable();
    await ensureSecureDirectory(this.storageDirectory);

    try {
      const encryptedKey = await readFile(this.keyPath);
      await chmod(this.keyPath, 0o600);

      return decodeKey(this.protector.decryptString(encryptedKey));
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
    }

    const key = this.options.randomKey?.() ?? randomBytes(encryptionKeyBytes);
    if (key.length !== encryptionKeyBytes) {
      throw new Error(`LinkedIn session key generator must return ${encryptionKeyBytes} bytes`);
    }

    const encryptedKey = this.protector.encryptString(key.toString("base64"));
    await writeSecureFileAtomically(this.storageDirectory, this.keyPath, encryptedKey);

    return Buffer.from(key);
  }

  private get keyPath(): string {
    return join(this.storageDirectory, keyFileName);
  }

  private ensureSafeStorageAvailable(): void {
    if (!this.protector.isEncryptionAvailable()) {
      throw new Error("Operating-system secure storage is unavailable for the LinkedIn session");
    }

    const platform = this.options.platform ?? process.platform;
    if (
      platform === "linux" &&
      !secureLinuxBackends.has(this.protector.getSelectedStorageBackend?.() ?? "unknown")
    ) {
      throw new Error("A Linux password manager is required to protect the LinkedIn session key");
    }
  }
}

function decodeKey(value: string): Buffer {
  const key = Buffer.from(value, "base64");

  if (key.length !== encryptionKeyBytes || key.toString("base64") !== value) {
    throw new Error("Stored LinkedIn session key is invalid");
  }

  return key;
}

async function ensureSecureDirectory(directory: string): Promise<void> {
  await mkdir(directory, { mode: 0o700, recursive: true });
  await chmod(directory, 0o700);
}

async function writeSecureFileAtomically(
  directory: string,
  destination: string,
  contents: Buffer,
): Promise<void> {
  const temporaryPath = join(directory, `.linkedin-session-key.${randomUUID()}.tmp`);

  try {
    await writeFile(temporaryPath, contents, { flag: "wx", mode: 0o600 });
    await rename(temporaryPath, destination);
    await chmod(destination, 0o600);
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
