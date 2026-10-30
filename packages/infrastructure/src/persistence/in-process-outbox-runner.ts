import { randomUUID } from "node:crypto";
import type { ClaimedOutboxEvent, PostgresOutboxRepository } from "./postgres-outbox.repository.js";

export interface InProcessOutboxHandler {
  name: string;
  types: string[];
  concurrency?: number;
  // Total tries including the first, matching the BullMQ queues' attempts option.
  maximumAttempts?: number;
  // Delay before the next try after the given failed attempt (1-based).
  retryDelayMs?: (attempt: number) => number;
  handle(event: ClaimedOutboxEvent): Promise<void>;
  // Errors that retrying cannot fix, such as validation failures.
  isUnrecoverable?(error: unknown): boolean;
  // Runs once when an event will not be retried, before it is dead-lettered.
  onTerminalFailure?(event: ClaimedOutboxEvent, error: unknown): Promise<void>;
}

export interface InProcessOutboxRunnerOptions {
  pollIntervalMs?: number;
  // Must outlast the slowest handler; a lapsed lease lets the event be claimed again.
  leaseDurationMs?: number;
  now?: () => Date;
  onError?: (message: string, error: unknown) => void;
}

interface HandlerState {
  handler: InProcessOutboxHandler;
  inFlight: Map<string, Promise<void>>;
}

// Processes outbox events in the same process that writes them, replacing the BullMQ workers for
// single-process runtimes. An event stays unprocessed until its handler finishes, so work
// interrupted by a shutdown is retried on the next start.
export class InProcessOutboxRunner {
  private readonly leaseOwner = randomUUID();
  private readonly states: HandlerState[];
  private readonly pollIntervalMs: number;
  private readonly leaseDurationMs: number;
  private readonly now: () => Date;
  private readonly onError: (message: string, error: unknown) => void;
  private interval: ReturnType<typeof setInterval> | undefined;
  private polling: Promise<void> | undefined;
  private closed = false;

  constructor(
    private readonly outbox: PostgresOutboxRepository,
    handlers: InProcessOutboxHandler[],
    options: InProcessOutboxRunnerOptions = {},
  ) {
    this.states = handlers.map((handler) => ({ handler, inFlight: new Map() }));
    this.pollIntervalMs = options.pollIntervalMs ?? 1_000;
    this.leaseDurationMs = options.leaseDurationMs ?? 60 * 60 * 1000;
    this.now = options.now ?? (() => new Date());
    this.onError = options.onError ?? ((message, error) => console.error(message, error));
  }

  async start(): Promise<void> {
    await this.outbox.releaseLeases(
      this.states.flatMap(({ handler }) => handler.types),
      this.now(),
    );
    await this.poll();
    this.interval = setInterval(() => void this.poll(), this.pollIntervalMs);
  }

  // Claims and starts whatever each handler has capacity for; does not wait for the work itself.
  poll(): Promise<void> {
    if (this.closed) return Promise.resolve();
    this.polling ??= this.claimAll().finally(() => {
      this.polling = undefined;
    });
    return this.polling;
  }

  // Resolves once every started event has finished.
  async idle(): Promise<void> {
    await this.polling;
    while (this.states.some(({ inFlight }) => inFlight.size > 0)) {
      await Promise.all(this.states.flatMap(({ inFlight }) => [...inFlight.values()]));
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    if (this.interval) clearInterval(this.interval);
    await this.idle();
  }

  private async claimAll(): Promise<void> {
    await Promise.all(this.states.map((state) => this.claim(state)));
  }

  private async claim(state: HandlerState): Promise<void> {
    const capacity = (state.handler.concurrency ?? 1) - state.inFlight.size;
    if (capacity <= 0) return;

    let events: ClaimedOutboxEvent[];
    try {
      events = await this.outbox.claimPending({
        types: state.handler.types,
        leaseOwner: this.leaseOwner,
        leaseDurationMs: this.leaseDurationMs,
        limit: capacity,
        now: this.now(),
      });
    } catch (error) {
      this.onError(`Outbox runner failed to claim ${state.handler.name} events`, error);
      return;
    }

    for (const event of events) {
      if (state.inFlight.has(event.id)) continue;
      const work = this.process(state.handler, event).finally(() => {
        state.inFlight.delete(event.id);
      });
      state.inFlight.set(event.id, work);
    }
  }

  private async process(handler: InProcessOutboxHandler, event: ClaimedOutboxEvent): Promise<void> {
    try {
      await handler.handle(event);
      await this.outbox.markProcessed(event.id, this.leaseOwner, this.now());
    } catch (error) {
      await this.fail(handler, event, error).catch((failure: unknown) => {
        this.onError(`Outbox runner failed to record a ${handler.name} failure`, failure);
      });
    }
  }

  private async fail(
    handler: InProcessOutboxHandler,
    event: ClaimedOutboxEvent,
    error: unknown,
  ): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    const attempt = event.attemptCount;
    const isTerminal =
      handler.isUnrecoverable?.(error) === true || attempt >= (handler.maximumAttempts ?? 3);

    if (!isTerminal) {
      const delayMs = (handler.retryDelayMs ?? defaultRetryDelayMs)(attempt);
      await this.outbox.markFailed(
        event.id,
        this.leaseOwner,
        message,
        new Date(this.now().getTime() + delayMs),
      );
      return;
    }

    this.onError(`Outbox runner gave up on ${handler.name} event ${event.id}`, error);
    await handler.onTerminalFailure?.(event, error);
    await this.outbox.markDeadLettered(event.id, this.leaseOwner, message, this.now());
  }
}

// Same exponential schedule as the BullMQ queues: 5s, then 10s.
function defaultRetryDelayMs(attempt: number): number {
  return 5_000 * 2 ** Math.max(0, attempt - 1);
}
