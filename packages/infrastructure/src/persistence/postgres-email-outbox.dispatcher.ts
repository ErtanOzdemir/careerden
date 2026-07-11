import type { NotificationEmailSender } from "@link2cv/domain";
import { outboxEventTypes } from "@link2cv/domain";
import { randomUUID } from "node:crypto";
import type { PostgresOutboxRepository } from "./postgres-outbox.repository.js";

const batchSize = 25;
const leaseDurationMs = 60_000;
const maximumBackoffMs = 15 * 60_000;

export class PostgresEmailOutboxDispatcher {
  private readonly leaseOwner = randomUUID();

  constructor(
    private readonly outbox: PostgresOutboxRepository,
    private readonly sender: NotificationEmailSender,
  ) {}

  async dispatchPending(): Promise<number> {
    const events = await this.outbox.claimPending({
      types: [outboxEventTypes.followUpReminderEmail],
      leaseOwner: this.leaseOwner,
      leaseDurationMs,
      limit: batchSize,
    });
    for (const event of events) {
      try {
        await this.sender.sendFollowUpReminder({
          messageId: requireString(event.payload, "messageId"),
          email: requireString(event.payload, "email"),
          companyName: optionalString(event.payload, "companyName"),
          roleTitle: optionalString(event.payload, "roleTitle"),
          followUpAt: new Date(requireString(event.payload, "followUpAt")),
          title: requireString(event.payload, "title"),
          description: optionalString(event.payload, "description"),
        });
        await this.outbox.markProcessed(event.id, this.leaseOwner);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const backoffMs = Math.min(
          5_000 * 2 ** Math.max(0, event.attemptCount - 1),
          maximumBackoffMs,
        );
        await this.outbox.markFailed(
          event.id,
          this.leaseOwner,
          message,
          new Date(Date.now() + backoffMs),
        );
      }
    }
    return events.length;
  }
}

function requireString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== "string") throw new Error(`Invalid email outbox payload: ${key}`);
  return value;
}

function optionalString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === "string" ? value : undefined;
}
