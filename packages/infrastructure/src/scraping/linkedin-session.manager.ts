import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  Page,
} from "playwright";
import { chromium } from "playwright";
import type { LinkedInSessionStatusResult } from "@link2cv/domain";

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
  iv: string;
  tag: string;
  payload: string;
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

  constructor(
    private readonly storageDir: string,
    private readonly secret: string,
    private readonly options: LinkedInSessionManagerOptions = {},
  ) {}

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

    const state =
      (await this.activeLogin.context.storageState()) as LinkedInStorageState;

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
        message:
          "Complete LinkedIn login in the opened browser, then save the session",
        updatedAt: this.activeLogin.startedAt,
      };
    }

    try {
      const state = await this.readEncryptedState();
      const file = await stat(this.sessionPath);

      if (
        !hasLinkedInAuthCookie(state) ||
        hasExpiredLinkedInAuthCookie(state)
      ) {
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
    return (
      this.options.launchBrowser?.() ?? chromium.launch({ headless: false })
    );
  }

  private async writeEncryptedState(
    state: LinkedInStorageState,
  ): Promise<void> {
    await mkdir(this.storageDir, { recursive: true });

    const iv = randomBytes(12);
    const cipher = createCipheriv(
      "aes-256-gcm",
      keyFromSecret(this.secret),
      iv,
    );
    const payload = Buffer.concat([
      cipher.update(JSON.stringify(state), "utf8"),
      cipher.final(),
    ]);
    const encrypted: EncryptedSessionFile = {
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      payload: payload.toString("base64"),
    };

    await writeFile(
      this.sessionPath,
      JSON.stringify(encrypted, null, 2),
      "utf8",
    );
  }

  private async readEncryptedState(): Promise<LinkedInStorageState> {
    const encrypted = JSON.parse(
      await readFile(this.sessionPath, "utf8"),
    ) as EncryptedSessionFile;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      keyFromSecret(this.secret),
      Buffer.from(encrypted.iv, "base64"),
    );

    decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encrypted.payload, "base64")),
      decipher.final(),
    ]);

    return JSON.parse(decrypted.toString("utf8")) as LinkedInStorageState;
  }
}

function keyFromSecret(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

function hasLinkedInAuthCookie(state: LinkedInStorageState): boolean {
  return state.cookies.some(
    (cookie) =>
      cookie.domain.includes("linkedin.com") && cookie.name === "li_at",
  );
}

function hasExpiredLinkedInAuthCookie(state: LinkedInStorageState): boolean {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const cookie = state.cookies.find(
    (candidate) =>
      candidate.domain.includes("linkedin.com") && candidate.name === "li_at",
  );

  return Boolean(cookie && cookie.expires > 0 && cookie.expires <= nowSeconds);
}

function isMissingFileError(error: unknown): boolean {
  const isMissing =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT";
  if (isMissing) {
    console.error("LinkedInSessionManager ENOENT error:", error);
  }
  return isMissing;
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Unknown browser launch error.";
}
