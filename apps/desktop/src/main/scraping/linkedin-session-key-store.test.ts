import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LinkedInSessionKeyStore,
  type SafeStorageKeyProtector,
} from "./linkedin-session-key-store.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("LinkedInSessionKeyStore", () => {
  it("creates one random key protected by safeStorage and reuses it", async () => {
    const directory = await createTemporaryDirectory();
    const protector = createProtector();
    const randomKey = vi.fn(() => Buffer.alloc(32, 7));
    const store = new LinkedInSessionKeyStore(directory, protector, {
      platform: "darwin",
      randomKey,
    });

    await expect(store.getOrCreateKey()).resolves.toEqual(Buffer.alloc(32, 7));
    await expect(store.getOrCreateKey()).resolves.toEqual(Buffer.alloc(32, 7));

    expect(randomKey).toHaveBeenCalledTimes(1);
    expect(protector.encryptString).toHaveBeenCalledTimes(1);
    expect(protector.decryptString).toHaveBeenCalledTimes(1);
    expect(
      await readFile(join(directory, "linkedin-session-key.safe-storage"), "utf8"),
    ).not.toContain(Buffer.alloc(32, 7).toString("base64"));
  });

  it("sets owner-only directory and key-file modes on POSIX platforms", async () => {
    if (process.platform === "win32") {
      return;
    }

    const directory = await createTemporaryDirectory();
    const store = new LinkedInSessionKeyStore(directory, createProtector(), {
      platform: "darwin",
      randomKey: () => Buffer.alloc(32, 9),
    });

    await store.getOrCreateKey();

    expect((await stat(directory)).mode & 0o777).toBe(0o700);
    expect((await stat(join(directory, "linkedin-session-key.safe-storage"))).mode & 0o777).toBe(
      0o600,
    );
  });

  it("fails closed when operating-system encryption is unavailable", async () => {
    const directory = await createTemporaryDirectory();
    const protector = createProtector();
    vi.mocked(protector.isEncryptionAvailable).mockReturnValue(false);

    await expect(
      new LinkedInSessionKeyStore(directory, protector, { platform: "darwin" }).getOrCreateKey(),
    ).rejects.toThrow("Operating-system secure storage is unavailable");
  });

  it("rejects Electron's insecure Linux basic-text backend", async () => {
    const directory = await createTemporaryDirectory();
    const protector = createProtector();
    vi.mocked(protector.getSelectedStorageBackend).mockReturnValue("basic_text");

    await expect(
      new LinkedInSessionKeyStore(directory, protector, { platform: "linux" }).getOrCreateKey(),
    ).rejects.toThrow("A Linux password manager is required");
  });

  it("rejects an unknown Linux safeStorage backend", async () => {
    const directory = await createTemporaryDirectory();
    const protector = createProtector();
    vi.mocked(protector.getSelectedStorageBackend).mockReturnValue("unknown");

    await expect(
      new LinkedInSessionKeyStore(directory, protector, { platform: "linux" }).getOrCreateKey(),
    ).rejects.toThrow("A Linux password manager is required");
  });
});

function createProtector(): SafeStorageKeyProtector {
  return {
    decryptString: vi.fn((encrypted) => encrypted.toString("utf8").split("").reverse().join("")),
    encryptString: vi.fn((plainText) =>
      Buffer.from(plainText.split("").reverse().join(""), "utf8"),
    ),
    getSelectedStorageBackend: vi.fn(() => "gnome_libsecret"),
    isEncryptionAvailable: vi.fn(() => true),
  };
}

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "careerden-linkedin-key-"));
  temporaryDirectories.push(directory);
  return directory;
}
