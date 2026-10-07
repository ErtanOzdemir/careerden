import { describe, expect, it, vi } from "vitest";
import { EmailDeliveryError } from "@careerden/domain";
import type { EmailSender, OutboxEvent } from "@careerden/domain";
import type { PostgresOutboxRepository } from "@careerden/infrastructure";
import {
  maximumEmailOutboxAgeMs,
  maximumEmailOutboxAttempts,
  PostgresEmailOutboxDispatcher,
} from "./postgres-email-outbox.dispatcher.js";

const dispatchNow = new Date("2026-07-02T08:50:00.000Z");

describe("PostgresEmailOutboxDispatcher", () => {
  it("sends with the persisted message ID before marking delivery processed", async () => {
    const calls: string[] = [];
    const outbox = createOutbox(
      {},
      {
        markProcessed: vi.fn(async () => {
          calls.push("processed");
          return true;
        }),
      },
    );
    const sender: EmailSender = {
      send: vi.fn(async () => {
        calls.push("sent");
      }),
    };

    await new PostgresEmailOutboxDispatcher(outbox, sender).dispatchPending(dispatchNow);

    expect(sender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: "<follow-up-1@careerden.local>",
        to: "ada@example.com",
        subject: "Follow-up reminder: Send a note",
      }),
    );
    expect(calls).toEqual(["sent", "processed"]);
    expect(outbox.markDeadLettered).not.toHaveBeenCalled();
  });

  it("retries after an SMTP failure without marking the event processed", async () => {
    const outbox = createOutbox();
    const onFailure = vi.fn();
    const sender: EmailSender = {
      send: vi.fn(async () => {
        throw new Error("smtp unavailable");
      }),
    };

    await new PostgresEmailOutboxDispatcher(outbox, sender, onFailure).dispatchPending(dispatchNow);

    expect(outbox.markProcessed).not.toHaveBeenCalled();
    expect(outbox.markDeadLettered).not.toHaveBeenCalled();
    expect(outbox.markFailed).toHaveBeenCalledWith(
      "event-1",
      expect.any(String),
      "Email delivery failed: delivery_error",
      expect.any(Date),
    );
    expect(onFailure).toHaveBeenCalledWith({
      eventId: "event-1",
      aggregateId: "follow-up-1",
      attemptCount: 1,
      outcome: "retry_scheduled",
      errorCode: "delivery_error",
    });
  });

  it("dead-letters a retryable failure after the maximum attempt count", async () => {
    const outbox = createOutbox({ attemptCount: maximumEmailOutboxAttempts });
    const sender: EmailSender = {
      send: vi.fn(async () => {
        throw new Error("network unavailable");
      }),
    };

    await new PostgresEmailOutboxDispatcher(outbox, sender).dispatchPending(dispatchNow);

    expect(outbox.markFailed).not.toHaveBeenCalled();
    expect(outbox.markDeadLettered).toHaveBeenCalledWith(
      "event-1",
      expect.any(String),
      "Email delivery failed: delivery_error",
    );
  });

  it("dead-letters a non-retryable provider failure immediately", async () => {
    const outbox = createOutbox();
    const sender: EmailSender = {
      send: vi.fn(async () => {
        throw new EmailDeliveryError({
          code: "invalid_from_address",
          message: "Resend email delivery failed: invalid_from_address",
          retryable: false,
        });
      }),
    };

    await new PostgresEmailOutboxDispatcher(outbox, sender).dispatchPending(dispatchNow);

    expect(outbox.markFailed).not.toHaveBeenCalled();
    expect(outbox.markDeadLettered).toHaveBeenCalledWith(
      "event-1",
      expect.any(String),
      "Resend email delivery failed: invalid_from_address",
    );
  });

  it("dead-letters an event before sending when the idempotency window is nearly expired", async () => {
    const outbox = createOutbox({
      createdAt: new Date(dispatchNow.getTime() - maximumEmailOutboxAgeMs),
    });
    const sender: EmailSender = { send: vi.fn() };

    await new PostgresEmailOutboxDispatcher(outbox, sender).dispatchPending(dispatchNow);

    expect(sender.send).not.toHaveBeenCalled();
    expect(outbox.markDeadLettered).toHaveBeenCalledWith(
      "event-1",
      expect.any(String),
      "Reminder email retry window expired",
      dispatchNow,
    );
  });
});

function createOutbox(
  eventOverrides: Partial<OutboxEvent> = {},
  repositoryOverrides: Record<string, unknown> = {},
): PostgresOutboxRepository {
  const event: OutboxEvent = {
    id: "event-1",
    type: "follow-up-reminder.email",
    aggregateId: "follow-up-1",
    payload: {
      messageId: "<follow-up-1@careerden.local>",
      email: "ada@example.com",
      companyName: "Acme",
      roleTitle: "Engineer",
      followUpAt: "2026-07-02T09:00:00.000Z",
      title: "Send a note",
      description: "Ask about next steps",
    },
    attemptCount: 1,
    createdAt: new Date("2026-07-02T08:45:00.000Z"),
    ...eventOverrides,
  };
  return {
    claimPending: vi.fn(async (input: { leaseOwner: string }) => [
      { ...event, leaseOwner: input.leaseOwner },
    ]),
    markProcessed: vi.fn(async () => true),
    markFailed: vi.fn(async () => true),
    markDeadLettered: vi.fn(async () => true),
    ...repositoryOverrides,
  } as unknown as PostgresOutboxRepository;
}
