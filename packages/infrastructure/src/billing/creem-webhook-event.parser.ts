import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  BillingSubscriptionStatus,
  NormalizedBillingProviderEvent,
  NormalizedBillingProviderEventType,
} from "@careerden/domain";

export class CreemWebhookSignatureError extends Error {
  constructor() {
    super("Invalid Creem webhook signature");
    this.name = "CreemWebhookSignatureError";
  }
}

export interface CreemWebhookEventParserOptions {
  webhookSecret: string;
  productId: string;
  planKey: string;
}

const normalizedEventTypes: Readonly<Record<string, NormalizedBillingProviderEventType>> = {
  "subscription.active": "subscription_active",
  "subscription.canceled": "subscription_canceled",
  "subscription.expired": "subscription_expired",
  "subscription.paid": "subscription_paid",
  "subscription.past_due": "subscription_past_due",
  "subscription.scheduled_cancel": "subscription_scheduled_cancel",
};

export class CreemWebhookEventParser {
  constructor(private readonly options: CreemWebhookEventParserOptions) {}

  parseAndVerify(rawBody: Buffer, signature: string | undefined): NormalizedBillingProviderEvent {
    this.verifySignature(rawBody, signature);
    const payload = asRecord(JSON.parse(rawBody.toString("utf8")));
    const providerEventId = requiredString(payload.id, "Creem event id");
    const originalEventType = requiredString(payload.eventType, "Creem event type");
    const object = asRecord(payload.object);
    const productId = nestedId(object.product);
    const eventType = normalizeEventType(originalEventType, object);
    const metadata = asOptionalRecord(object.metadata);
    const receivedAt = timestampToDate(payload.created_at) ?? new Date();

    if (productId && productId !== this.options.productId) {
      return {
        provider: "creem",
        providerEventId,
        eventType: "ignored",
        originalEventType,
        payload,
        receivedAt,
      };
    }

    return {
      provider: "creem",
      providerEventId,
      eventType,
      originalEventType,
      userId: optionalString(metadata?.userId),
      providerCustomerId: nestedId(object.customer),
      providerSubscriptionId:
        object.object === "subscription"
          ? optionalString(object.id)
          : nestedId(object.subscription),
      providerTransactionId: optionalString(object.last_transaction_id),
      planKey: optionalString(metadata?.planKey) ?? this.options.planKey,
      status: normalizeSubscriptionStatus(object.status),
      currentPeriodStart: stringToDate(object.current_period_start_date),
      currentPeriodEnd: stringToDate(object.current_period_end_date),
      cancelAtPeriodEnd:
        eventType === "subscription_scheduled_cancel"
          ? true
          : eventType === "subscription_canceled"
            ? false
            : optionalBoolean(object.cancel_at_period_end),
      payload,
      receivedAt,
    };
  }

  private verifySignature(rawBody: Buffer, signature: string | undefined): void {
    if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) {
      throw new CreemWebhookSignatureError();
    }
    const expected = createHmac("sha256", this.options.webhookSecret).update(rawBody).digest();
    const received = Buffer.from(signature, "hex");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      throw new CreemWebhookSignatureError();
    }
  }
}

function normalizeEventType(
  eventType: string,
  object: Record<string, unknown>,
): NormalizedBillingProviderEventType {
  const normalized = normalizedEventTypes[eventType];
  if (normalized) return normalized;
  if (eventType === "subscription.update") {
    return normalizeSubscriptionStatus(object.status) ? "subscription_updated" : "ignored";
  }
  return "ignored";
}

function normalizeSubscriptionStatus(value: unknown): BillingSubscriptionStatus | undefined {
  return ["active", "past_due", "canceled", "expired"].includes(String(value))
    ? (value as BillingSubscriptionStatus)
    : undefined;
}

function nestedId(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  return optionalString(asOptionalRecord(value)?.id);
}

function timestampToDate(value: unknown): Date | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return new Date(value);
}

function stringToDate(value: unknown): Date | undefined {
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function requiredString(value: unknown, label: string): string {
  const parsed = optionalString(value);
  if (!parsed) throw new Error(`${label} is missing`);
  return parsed;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Creem webhook payload must be an object");
  }
  return value as Record<string, unknown>;
}

function asOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
