import { describe, expect, it, vi } from "vitest";
import type { NotificationEmailSender, OutboxEvent } from "@link2cv/domain";
import type { PostgresOutboxRepository } from "./postgres-outbox.repository.js";
import { PostgresEmailOutboxDispatcher } from "./postgres-email-outbox.dispatcher.js";

describe("PostgresEmailOutboxDispatcher", () => {
  it("sends with the persisted message ID before marking delivery processed", async () => {
    const calls: string[] = [];
    const outbox = createOutbox({
      markProcessed: vi.fn(async () => {
        calls.push("processed");
        return true;
      }),
    });
    const sender: NotificationEmailSender = {
      sendFollowUpReminder: vi.fn(async () => {
        calls.push("sent");
      }),
    };

    await new PostgresEmailOutboxDispatcher(outbox, sender).dispatchPending();

    expect(sender.sendFollowUpReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: "<follow-up-1@link2cv.local>",
        email: "ada@example.com",
      }),
    );
    expect(calls).toEqual(["sent", "processed"]);
  });

  it("retries after an SMTP failure without marking the event processed", async () => {
    const outbox = createOutbox();
    const sender: NotificationEmailSender = {
      sendFollowUpReminder: vi.fn(async () => {
        throw new Error("smtp unavailable");
      }),
    };

    await new PostgresEmailOutboxDispatcher(outbox, sender).dispatchPending();

    expect(outbox.markProcessed).not.toHaveBeenCalled();
    expect(outbox.markFailed).toHaveBeenCalledWith(
      "event-1",
      expect.any(String),
      "smtp unavailable",
      expect.any(Date),
    );
  });
});

function createOutbox(overrides: Record<string, unknown> = {}): PostgresOutboxRepository {
  const event: OutboxEvent = {
    id: "event-1",
    type: "follow-up-reminder.email",
    aggregateId: "follow-up-1",
    payload: {
      messageId: "<follow-up-1@link2cv.local>",
      email: "ada@example.com",
      companyName: "Acme",
      roleTitle: "Engineer",
      followUpAt: "2026-07-02T09:00:00.000Z",
      title: "Send a note",
      description: "Ask about next steps",
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
