import type { EmailSender } from "@careerden/domain";
import { outboxEventTypes } from "@careerden/domain";
import { randomUUID } from "node:crypto";
import type { PostgresOutboxRepository } from "./postgres-outbox.repository.js";

const batchSize = 25;
const leaseDurationMs = 60_000;
const maximumBackoffMs = 15 * 60_000;

export class PostgresEmailOutboxDispatcher {
  private readonly leaseOwner = randomUUID();

  constructor(
    private readonly outbox: PostgresOutboxRepository,
    private readonly sender: EmailSender,
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
        const companyName = optionalString(event.payload, "companyName");
        const roleTitle = optionalString(event.payload, "roleTitle");
        const followUpAt = new Date(requireString(event.payload, "followUpAt"));
        const title = requireString(event.payload, "title");
        const description = optionalString(event.payload, "description");
        const target = [companyName, roleTitle].filter(Boolean).join(" - ") || "your application";
        const formattedFollowUpAt = followUpAt.toLocaleString();

        await this.sender.send({
          messageId: requireString(event.payload, "messageId"),
          to: requireString(event.payload, "email"),
          subject: `Follow-up reminder: ${title}`,
          text: `Reminder: ${title} — follow up on ${target} at ${formattedFollowUpAt}.${description ? `\n\n${description}` : ""}`,
          html: `<p>Reminder: <strong>${escapeHtml(title)}</strong> — follow up on <strong>${escapeHtml(target)}</strong> at ${escapeHtml(formattedFollowUpAt)}.</p>${description ? `<p>${escapeHtml(description)}</p>` : ""}`,
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
