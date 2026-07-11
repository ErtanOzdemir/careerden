import { describe, expect, it, vi } from "vitest";
import type { JobApplicationQueue, OutboxEvent } from "@link2cv/domain";
import type { PostgresOutboxRepository } from "./postgres-outbox.repository.js";
import { PostgresAnalysisOutboxDispatcher } from "./postgres-analysis-outbox.dispatcher.js";

describe("PostgresAnalysisOutboxDispatcher", () => {
  it("uses the outbox event ID as the idempotent BullMQ job ID", async () => {
    const outbox = createOutbox();
    const queue = createQueue();

    await new PostgresAnalysisOutboxDispatcher(outbox, queue).dispatchPending();

    expect(queue.enqueue).toHaveBeenCalledWith(
      { jobApplicationId: "application-1", analysisAttemptId: "event-1" },
      { jobId: "event-1" },
    );
    expect(outbox.markProcessed).toHaveBeenCalledWith("event-1", expect.any(String));
  });

  it("releases the outbox event when BullMQ is unavailable", async () => {
    const outbox = createOutbox();
    const queue = createQueue();
    vi.mocked(queue.enqueue).mockRejectedValue(new Error("redis unavailable"));

    await new PostgresAnalysisOutboxDispatcher(outbox, queue).dispatchPending();

    expect(outbox.markProcessed).not.toHaveBeenCalled();
    expect(outbox.markFailed).toHaveBeenCalledWith(
      "event-1",
      expect.any(String),
      "redis unavailable",
      expect.any(Date),
    );
  });
});

function createQueue(): JobApplicationQueue {
  return {
    enqueue: vi.fn(),
    restart: vi.fn(),
  };
}

function createOutbox(): PostgresOutboxRepository {
  const event: OutboxEvent = {
    id: "event-1",
    type: "job-application.analysis-requested",
    aggregateId: "application-1",
    payload: { jobApplicationId: "application-1" },
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
