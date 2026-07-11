import { describe, expect, it, vi } from "vitest";
import type { JobApplicationChangePublisher, OutboxEvent } from "@link2cv/domain";
import type { PostgresOutboxRepository } from "./postgres-outbox.repository.js";
import { PostgresJobApplicationChangeOutboxDispatcher } from "./postgres-outbox.dispatcher.js";

describe("PostgresJobApplicationChangeOutboxDispatcher", () => {
  it("publishes a claimed change before marking it processed", async () => {
    const calls: string[] = [];
    const outbox = createOutbox({
      markProcessed: vi.fn(async () => {
        calls.push("processed");
        return true;
      }),
    });
    const changes: JobApplicationChangePublisher = {
      publish: vi.fn(async () => {
        calls.push("published");
      }),
    };

    const count = await new PostgresJobApplicationChangeOutboxDispatcher(
      outbox,
      changes,
    ).dispatchPending();

    expect(count).toBe(1);
    expect(calls).toEqual(["published", "processed"]);
    expect(outbox.markFailed).not.toHaveBeenCalled();
  });

  it("releases a failed event with retry backoff instead of marking it processed", async () => {
    const outbox = createOutbox();
    const changes: JobApplicationChangePublisher = {
      publish: vi.fn(async () => {
        throw new Error("redis unavailable");
      }),
    };

    await new PostgresJobApplicationChangeOutboxDispatcher(outbox, changes).dispatchPending();

    expect(outbox.markProcessed).not.toHaveBeenCalled();
    expect(outbox.markFailed).toHaveBeenCalledWith(
      "event-1",
      expect.any(String),
      "redis unavailable",
      expect.any(Date),
    );
  });
});

function createOutbox(overrides: Record<string, unknown> = {}): PostgresOutboxRepository {
  const event: OutboxEvent = {
    id: "event-1",
    type: "job-application.change",
    aggregateId: "application-1",
    payload: {
      type: "application.changed",
      applicationId: "application-1",
      profileId: "profile-1",
      occurredAt: "2026-07-11T12:00:00.000Z",
    },
    attemptCount: 1,
  };

  return {
    claimPending: vi.fn(async (input: { leaseOwner: string }) => [
      { ...event, leaseOwner: input.leaseOwner },
    ]),
    markProcessed: vi.fn(async () => true),
    markFailed: vi.fn(async () => true),
    ...overrides,
  } as unknown as PostgresOutboxRepository;
}
