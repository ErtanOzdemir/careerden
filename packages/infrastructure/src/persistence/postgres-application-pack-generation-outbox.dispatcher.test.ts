import { describe, expect, it, vi } from "vitest";
import type { ApplicationPackGenerationQueue, OutboxEvent } from "@careerden/domain";
import { PostgresApplicationPackGenerationOutboxDispatcher } from "./postgres-application-pack-generation-outbox.dispatcher.js";
import type { PostgresOutboxRepository } from "./postgres-outbox.repository.js";

describe("PostgresApplicationPackGenerationOutboxDispatcher", () => {
  it("delivers the generation attempt with an idempotent outbox job ID", async () => {
    const outbox = createOutbox();
    const queue: ApplicationPackGenerationQueue = { enqueue: vi.fn() };

    await new PostgresApplicationPackGenerationOutboxDispatcher(outbox, queue).dispatchPending();

    expect(queue.enqueue).toHaveBeenCalledWith(
      { jobApplicationId: "application-1", generationAttemptId: "attempt-1" },
      { jobId: "event-1" },
    );
    expect(outbox.markProcessed).toHaveBeenCalledWith("event-1", expect.any(String));
  });

  it("releases the event when queue delivery fails", async () => {
    const outbox = createOutbox();
    const queue: ApplicationPackGenerationQueue = {
      enqueue: vi.fn(async () => Promise.reject(new Error("redis unavailable"))),
    };

    await new PostgresApplicationPackGenerationOutboxDispatcher(outbox, queue).dispatchPending();

    expect(outbox.markProcessed).not.toHaveBeenCalled();
    expect(outbox.markFailed).toHaveBeenCalledWith(
      "event-1",
      expect.any(String),
      "redis unavailable",
      expect.any(Date),
    );
  });
});

function createOutbox(): PostgresOutboxRepository {
  const event: OutboxEvent = {
    id: "event-1",
    type: "application-pack.generation-requested",
    aggregateId: "application-1",
    payload: { jobApplicationId: "application-1", generationAttemptId: "attempt-1" },
    attemptCount: 1,
  };

  return {
    claimPending: vi.fn(async (input: { leaseOwner: string }) => [
      { ...event, leaseOwner: input.leaseOwner },
    ]),
    markProcessed: vi.fn(async () => true),
    markFailed: vi.fn(async () => true),
  } as unknown as PostgresOutboxRepository;
}
