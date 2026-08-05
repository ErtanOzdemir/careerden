import { EmailDeliveryError, outboxEventTypes } from "@careerden/domain";
import type { EmailSender } from "@careerden/domain";
import { randomUUID } from "node:crypto";
import type { PostgresOutboxRepository } from "./postgres-outbox.repository.js";

const batchSize = 25;
const leaseDurationMs = 60_000;
const maximumBackoffMs = 15 * 60_000;
export const maximumEmailOutboxAttempts = 20;
export const maximumEmailOutboxAgeMs = 23 * 60 * 60_000;

export interface EmailOutboxDispatchFailure {
  eventId: string;
  aggregateId?: string;
  attemptCount: number;
  outcome: "retry_scheduled" | "dead_lettered";
  errorCode: string;
}

export class PostgresEmailOutboxDispatcher {
  private readonly leaseOwner = randomUUID();

  constructor(
    private readonly outbox: PostgresOutboxRepository,
    private readonly sender: EmailSender,
    private readonly onFailure?: (failure: EmailOutboxDispatchFailure) => void,
  ) {}

  async dispatchPending(now = new Date()): Promise<number> {
    const events = await this.outbox.claimPending({
      types: [outboxEventTypes.followUpReminderEmail],
      leaseOwner: this.leaseOwner,
      leaseDurationMs,
      limit: batchSize,
      now,
    });
    for (const event of events) {
      if (now.getTime() - event.createdAt.getTime() >= maximumEmailOutboxAgeMs) {
        const message = "Reminder email retry window expired";
        if (!(await this.outbox.markDeadLettered(event.id, this.leaseOwner, message, now))) {
          throw new Error("Email outbox lease was lost before dead-letter acknowledgement");
        }
        this.onFailure?.({
          eventId: event.id,
          aggregateId: event.aggregateId,
          attemptCount: event.attemptCount,
          outcome: "dead_lettered",
          errorCode: "retry_window_expired",
        });
        continue;
      }

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
        if (!(await this.outbox.markProcessed(event.id, this.leaseOwner))) {
          throw new Error("Email outbox lease was lost before processing acknowledgement");
        }
      } catch (error) {
        const failure = toEmailFailure(error);
        const message = failure.message;
        const terminal =
          (error instanceof EmailDeliveryError && !error.retryable) ||
          event.attemptCount >= maximumEmailOutboxAttempts;
        const errorCode = failure.code;

        if (terminal) {
          if (!(await this.outbox.markDeadLettered(event.id, this.leaseOwner, message))) {
            throw new Error("Email outbox lease was lost before dead-letter acknowledgement", {
              cause: error,
            });
          }
          this.onFailure?.({
            eventId: event.id,
            aggregateId: event.aggregateId,
            attemptCount: event.attemptCount,
            outcome: "dead_lettered",
            errorCode,
          });
          continue;
        }

        const backoffMs = Math.min(
          5_000 * 2 ** Math.max(0, event.attemptCount - 1),
          maximumBackoffMs,
        );
        if (
          !(await this.outbox.markFailed(
            event.id,
            this.leaseOwner,
            message,
            new Date(now.getTime() + backoffMs),
          ))
        ) {
          throw new Error("Email outbox lease was lost before retry acknowledgement", {
            cause: error,
          });
        }
        this.onFailure?.({
          eventId: event.id,
          aggregateId: event.aggregateId,
          attemptCount: event.attemptCount,
          outcome: "retry_scheduled",
          errorCode,
        });
      }
    }
    return events.length;
  }
}

function toEmailFailure(error: unknown): { code: string; message: string } {
  if (error instanceof EmailDeliveryError) {
    return { code: error.code, message: error.message };
  }

  const transportCode =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    /^[A-Za-z0-9_]{1,64}$/.test(error.code)
      ? error.code
      : "delivery_error";
  return {
    code: transportCode,
    message: `Email delivery failed: ${transportCode}`,
  };
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
