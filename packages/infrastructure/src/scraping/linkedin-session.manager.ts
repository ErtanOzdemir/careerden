import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Browser, BrowserContext, BrowserContextOptions, Page } from "playwright";
import { chromium } from "playwright";
import type { LinkedInSessionStatusResult } from "@careerden/domain";

export type LinkedInStorageState = Exclude<
  BrowserContextOptions["storageState"],
  string | undefined
>;

interface ActiveLogin {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  startedAt: Date;
}

interface EncryptedSessionFile {
  algorithm: "aes-256-gcm";
  iv: string;
  payload: string;
  tag: string;
  version: 2;
}

interface LinkedInSessionManagerOptions {
  launchBrowser?: () => Promise<Browser>;
}

export class LinkedInSessionRequiredError extends Error {
  constructor(message = "LinkedIn session is required") {
    super(message);
    this.name = "LinkedInSessionRequiredError";
  }
}

export class LinkedInSessionManager {
  private activeLogin?: ActiveLogin;
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly storageDir: string,
    encryptionKey: Buffer,
    private readonly options: LinkedInSessionManagerOptions = {},
  ) {
    if (encryptionKey.length !== 32) {
      throw new Error("LinkedIn session encryption key must be exactly 32 bytes");
    }

    this.encryptionKey = Buffer.from(encryptionKey);
  }

  async startLogin(): Promise<LinkedInSessionStatusResult> {
    if (this.activeLogin) {
      return {
        status: "login_in_progress",
        message: "A LinkedIn login browser is already open",
        updatedAt: this.activeLogin.startedAt,
      };
    }

    let browser: Browser | undefined;

    try {
      browser = await this.launchBrowser();
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto("https://www.linkedin.com/login", {
        waitUntil: "domcontentloaded",
      });

      this.activeLogin = {
        browser,
        context,
        page,
        startedAt: new Date(),
      };

      return {
        status: "login_in_progress",
        message:
          "A separate LinkedIn login window opened. Complete login there, then click 'I Logged In, Save Session'.",
        updatedAt: this.activeLogin.startedAt,
      };
    } catch (error) {
      await browser?.close().catch(() => undefined);

      return {
        status: "missing",
        message: `Could not open the LinkedIn login browser. ${errorMessage(error)}`,
      };
    }
  }

  async saveLogin(): Promise<LinkedInSessionStatusResult> {
    if (!this.activeLogin) {
      return this.getStatus();
    }

    const state = (await this.activeLogin.context.storageState()) as LinkedInStorageState;

    if (!hasLinkedInAuthCookie(state)) {
      return {
        status: "login_in_progress",
        message: "LinkedIn login is not complete yet",
      };
    }

    await this.writeEncryptedState(state);
    await this.closeActiveLogin();

    return {
      status: "connected",
      message: "LinkedIn session saved",
      updatedAt: new Date(),
    };
  }

  async getStatus(): Promise<LinkedInSessionStatusResult> {
    if (this.activeLogin) {
      return {
        status: "login_in_progress",
        message: "Complete LinkedIn login in the opened browser, then save the session",
        updatedAt: this.activeLogin.startedAt,
      };
    }

    try {
      const state = await this.readEncryptedState();
      const file = await stat(this.sessionPath);

      if (!hasLinkedInAuthCookie(state) || hasExpiredLinkedInAuthCookie(state)) {
        return {
          status: "expired",
          message: "LinkedIn session is missing or expired; reconnect it",
          updatedAt: file.mtime,
        };
      }

      return {
        status: "connected",
        message: "LinkedIn session is connected",
        updatedAt: file.mtime,
      };
    } catch (error) {
      if (isMissingFileError(error)) {
        return {
          status: "missing",
          message: "LinkedIn session has not been connected",
        };
      }

      if (error instanceof InvalidLinkedInSessionFileError) {
        return {
          status: "expired",
          message: "LinkedIn session could not be decrypted; reconnect it",
          updatedAt: await this.sessionUpdatedAt(),
        };
      }

      throw error;
    }
  }

  async getStorageState(): Promise<LinkedInStorageState> {
    const status = await this.getStatus();

    if (status.status !== "connected") {
      throw new LinkedInSessionRequiredError(status.message);
    }

    return this.readEncryptedState();
  }

  async closeActiveLogin(): Promise<void> {
    if (!this.activeLogin) {
      return;
    }

    await this.activeLogin.browser.close();
    this.activeLogin = undefined;
  }

  private get sessionPath(): string {
    return join(this.storageDir, "linkedin-session.enc.json");
  }

  private launchBrowser(): Promise<Browser> {
    return this.options.launchBrowser?.() ?? chromium.launch({ headless: false });
  }

  private async writeEncryptedState(state: LinkedInStorageState): Promise<void> {
    await ensureSecureDirectory(this.storageDir);

    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey, iv);
    const payload = Buffer.concat([cipher.update(JSON.stringify(state), "utf8"), cipher.final()]);
    const encrypted: EncryptedSessionFile = {
      algorithm: "aes-256-gcm",
      iv: iv.toString("base64"),
      payload: payload.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      version: 2,
    };

    await writeSecureFileAtomically(
      this.storageDir,
      this.sessionPath,
      JSON.stringify(encrypted, null, 2),
    );
  }

  private async readEncryptedState(): Promise<LinkedInStorageState> {
    try {
      await chmod(this.storageDir, 0o700);
      await chmod(this.sessionPath, 0o600);
      const encrypted = parseEncryptedSessionFile(
        JSON.parse(await readFile(this.sessionPath, "utf8")) as unknown,
      );
      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.encryptionKey,
        Buffer.from(encrypted.iv, "base64"),
      );

      decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));

      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encrypted.payload, "base64")),
        decipher.final(),
      ]);
      const state = JSON.parse(decrypted.toString("utf8")) as unknown;

      if (!isLinkedInStorageState(state)) {
        throw new InvalidLinkedInSessionFileError();
      }

      return state;
    } catch (error) {
      if (isMissingFileError(error)) {
        throw error;
      }

      if (error instanceof InvalidLinkedInSessionFileError) {
        throw error;
      }

      throw new InvalidLinkedInSessionFileError();
    }
  }

  private async sessionUpdatedAt(): Promise<Date | undefined> {
    return stat(this.sessionPath)
      .then((file) => file.mtime)
      .catch(() => undefined);
  }
}

class InvalidLinkedInSessionFileError extends Error {
  constructor() {
    super("LinkedIn session file is invalid or cannot be decrypted");
    this.name = "InvalidLinkedInSessionFileError";
  }
}

function hasLinkedInAuthCookie(state: LinkedInStorageState): boolean {
  return state.cookies.some(
    (cookie) => cookie.domain.includes("linkedin.com") && cookie.name === "li_at",
  );
}

function hasExpiredLinkedInAuthCookie(state: LinkedInStorageState): boolean {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const cookie = state.cookies.find(
    (candidate) => candidate.domain.includes("linkedin.com") && candidate.name === "li_at",
  );

  return Boolean(cookie && cookie.expires > 0 && cookie.expires <= nowSeconds);
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown browser launch error.";
}

function parseEncryptedSessionFile(value: unknown): EncryptedSessionFile {
  if (
    typeof value !== "object" ||
    value === null ||
    !("version" in value) ||
    value.version !== 2 ||
    !("algorithm" in value) ||
    value.algorithm !== "aes-256-gcm" ||
    !("iv" in value) ||
    typeof value.iv !== "string" ||
    !("tag" in value) ||
    typeof value.tag !== "string" ||
    !("payload" in value) ||
    typeof value.payload !== "string"
  ) {
    throw new InvalidLinkedInSessionFileError();
  }

  return value as EncryptedSessionFile;
}

function isLinkedInStorageState(value: unknown): value is LinkedInStorageState {
  return (
    typeof value === "object" &&
    value !== null &&
    "cookies" in value &&
    Array.isArray(value.cookies) &&
    (!("origins" in value) || Array.isArray(value.origins))
  );
}

async function ensureSecureDirectory(directory: string): Promise<void> {
  await mkdir(directory, { mode: 0o700, recursive: true });
  await chmod(directory, 0o700);
}

async function writeSecureFileAtomically(
  directory: string,
  destination: string,
  contents: string | Buffer,
): Promise<void> {
  const temporaryPath = join(directory, `.linkedin-session.${randomUUID()}.tmp`);

  try {
    await writeFile(temporaryPath, contents, { flag: "wx", mode: 0o600 });
    await rename(temporaryPath, destination);
    await chmod(destination, 0o600);
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}
