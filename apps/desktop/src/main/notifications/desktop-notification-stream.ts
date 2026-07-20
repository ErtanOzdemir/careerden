import { notificationChangeSchema } from "@link2cv/contracts";
import type { NotificationChangeDto } from "@link2cv/contracts";

const retryDelaysMs = [1_000, 2_000, 5_000, 10_000, 30_000] as const;
const deliveredNotificationLimit = 256;

type NotificationStreamFetch = (input: string, init: RequestInit) => Promise<Response>;

type ConnectResult =
  | { kind: "ended"; receivedNotification: boolean }
  | { kind: "not-found" }
  | { kind: "unauthorized" };

export class DesktopNotificationStream {
  private readonly apiBaseUrl: string;
  private readonly deliveredNotificationIds = new Set<string>();
  private readonly deliveredNotificationOrder: string[] = [];
  private connectionController?: AbortController;
  private releaseWait?: () => void;
  private restartVersion = 0;
  private runPromise?: Promise<void>;
  private started = false;

  constructor(
    private readonly options: {
      apiBaseUrl: string;
      fetch: NotificationStreamFetch;
      onChange: (change: NotificationChangeDto) => void;
      onError?: (error: unknown) => void;
    },
  ) {
    this.apiBaseUrl = options.apiBaseUrl.replace(/\/$/, "");
  }

  start(): void {
    if (this.started) return;

    this.started = true;
    this.runPromise = this.run()
      .catch((error: unknown) => this.reportError(error))
      .finally(() => {
        this.connectionController = undefined;
        this.releasePendingWait();
        this.started = false;
      });
  }

  wake(): void {
    if (!this.started) return;

    this.restartVersion += 1;
    this.connectionController?.abort();
    this.releasePendingWait();
  }

  async stop(): Promise<void> {
    if (!this.started && !this.runPromise) return;

    this.started = false;
    this.restartVersion += 1;
    this.connectionController?.abort();
    this.releasePendingWait();
    await this.runPromise;
    this.runPromise = undefined;
  }

  private async run(): Promise<void> {
    let retryAttempt = 0;

    while (this.started) {
      const version = this.restartVersion;
      const controller = new AbortController();
      this.connectionController = controller;

      let result: ConnectResult;

      try {
        result = await this.connect(controller.signal);
      } catch (error) {
        if (!this.started) return;

        if (version !== this.restartVersion || controller.signal.aborted) {
          retryAttempt = 0;
          continue;
        }

        this.reportError(error);
        await this.waitForRestart(getDesktopNotificationRetryDelayMs(retryAttempt), version);
        retryAttempt = version === this.restartVersion && this.started ? retryAttempt + 1 : 0;
        continue;
      } finally {
        if (this.connectionController === controller) {
          this.connectionController = undefined;
        }
      }

      if (!this.started) return;
      if (version !== this.restartVersion) {
        retryAttempt = 0;
        continue;
      }

      if (result.kind === "not-found") {
        this.reportError(
          new Error("The Link2CV API does not support desktop notification streaming"),
        );
        return;
      }

      if (result.kind === "unauthorized") {
        retryAttempt = 0;
        await this.waitForRestart(undefined, version);
        continue;
      }

      if (result.receivedNotification) {
        retryAttempt = 0;
      }

      await this.waitForRestart(getDesktopNotificationRetryDelayMs(retryAttempt), version);
      retryAttempt = version === this.restartVersion && this.started ? retryAttempt + 1 : 0;
    }
  }

  private async connect(signal: AbortSignal): Promise<ConnectResult> {
    const response = await this.options.fetch(`${this.apiBaseUrl}/notifications/stream`, {
      credentials: "include",
      headers: { Accept: "text/event-stream" },
      method: "GET",
      signal,
    });

    if (response.status === 401 || response.status === 403) {
      return { kind: "unauthorized" };
    }

    if (response.status === 404) {
      return { kind: "not-found" };
    }

    if (!response.ok) {
      throw new Error(`Notification stream request failed with status ${response.status}`);
    }

    if (!response.body) {
      throw new Error("Notification stream response did not include a body");
    }

    return {
      kind: "ended",
      receivedNotification: await this.readEvents(response.body, signal),
    };
  }

  private async readEvents(
    body: ReadableStream<Uint8Array>,
    signal: AbortSignal,
  ): Promise<boolean> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let receivedNotification = false;
    const parser = new ServerSentEventParser((eventName, data) => {
      if (eventName && eventName !== "notification.created") return;

      const change = parseNotificationChange(data);
      if (!change || !this.rememberNotification(change.notification.id)) return;

      receivedNotification = true;

      try {
        this.options.onChange(change);
      } catch (error) {
        this.reportError(error);
      }
    });
    const cancelReader = () => {
      void reader.cancel().catch(() => undefined);
    };

    signal.addEventListener("abort", cancelReader, { once: true });

    try {
      while (!signal.aborted) {
        const result = await reader.read();
        if (result.done) break;
        parser.push(decoder.decode(result.value, { stream: true }));
      }

      parser.finish(decoder.decode());
      return receivedNotification;
    } finally {
      signal.removeEventListener("abort", cancelReader);
      reader.releaseLock();
    }
  }

  private rememberNotification(notificationId: string): boolean {
    if (this.deliveredNotificationIds.has(notificationId)) return false;

    this.deliveredNotificationIds.add(notificationId);
    this.deliveredNotificationOrder.push(notificationId);

    if (this.deliveredNotificationOrder.length > deliveredNotificationLimit) {
      const oldestId = this.deliveredNotificationOrder.shift();
      if (oldestId) this.deliveredNotificationIds.delete(oldestId);
    }

    return true;
  }

  private async waitForRestart(delayMs: number | undefined, version: number): Promise<void> {
    if (!this.started || version !== this.restartVersion) return;

    await new Promise<void>((resolve) => {
      let timeout: NodeJS.Timeout | undefined;
      const release = () => {
        if (timeout) clearTimeout(timeout);
        if (this.releaseWait === release) this.releaseWait = undefined;
        resolve();
      };

      this.releaseWait = release;

      if (delayMs !== undefined) {
        timeout = setTimeout(release, delayMs);
      }

      if (!this.started || version !== this.restartVersion) {
        release();
      }
    });
  }

  private releasePendingWait(): void {
    this.releaseWait?.();
  }

  private reportError(error: unknown): void {
    this.options.onError?.(error);
  }
}

export function getDesktopNotificationRetryDelayMs(attempt: number): number {
  return retryDelaysMs[Math.min(Math.max(attempt, 0), retryDelaysMs.length - 1)];
}

function parseNotificationChange(data: string): NotificationChangeDto | null {
  try {
    const result = notificationChangeSchema.safeParse(JSON.parse(data));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

class ServerSentEventParser {
  private buffer = "";
  private dataLines: string[] = [];
  private eventName = "";

  constructor(private readonly onEvent: (eventName: string, data: string) => void) {}

  push(chunk: string): void {
    this.buffer += chunk;
    let lineBreak = this.buffer.indexOf("\n");

    while (lineBreak >= 0) {
      const line = this.buffer.slice(0, lineBreak).replace(/\r$/, "");
      this.buffer = this.buffer.slice(lineBreak + 1);
      this.processLine(line);
      lineBreak = this.buffer.indexOf("\n");
    }
  }

  finish(chunk: string): void {
    this.buffer += chunk;

    if (this.buffer) {
      this.processLine(this.buffer.replace(/\r$/, ""));
      this.buffer = "";
    }

    this.dispatch();
  }

  private processLine(line: string): void {
    if (!line) {
      this.dispatch();
      return;
    }

    if (line.startsWith(":")) return;

    const separator = line.indexOf(":");
    const field = separator < 0 ? line : line.slice(0, separator);
    let value = separator < 0 ? "" : line.slice(separator + 1);
    if (value.startsWith(" ")) value = value.slice(1);

    if (field === "event") {
      this.eventName = value;
    } else if (field === "data") {
      this.dataLines.push(value);
    }
  }

  private dispatch(): void {
    if (this.dataLines.length > 0) {
      this.onEvent(this.eventName, this.dataLines.join("\n"));
    }

    this.dataLines = [];
    this.eventName = "";
  }
}
