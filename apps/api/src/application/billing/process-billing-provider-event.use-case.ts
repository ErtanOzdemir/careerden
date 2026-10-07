import type {
  BillingSubscription,
  NormalizedBillingProviderEvent,
  PersistenceTransaction,
  PersistenceUnitOfWork,
} from "@careerden/domain";
import { subscriptionMonthlyCreditAmount } from "../../domain/billing/credit-policy.js";
import { ApplicationError } from "@careerden/application";

export class ProcessBillingProviderEventUseCase {
  constructor(private readonly unitOfWork: PersistenceUnitOfWork) {}

  async execute(event: NormalizedBillingProviderEvent): Promise<{ processed: boolean }> {
    try {
      return await this.unitOfWork.execute(async (transaction) => {
        const start = await transaction.billingSubscriptions.beginProviderEvent(event);
        if (!start.shouldProcess) return { processed: false };

        if (event.eventType !== "ignored") {
          await applySubscriptionEvent(transaction, event);
        }
        await transaction.billingSubscriptions.markProviderEventProcessed(
          event.provider,
          event.providerEventId,
          new Date(),
        );
        return { processed: true };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown billing event error";
      await this.unitOfWork.execute(({ billingSubscriptions }) =>
        billingSubscriptions.recordProviderEventFailure(event, message, new Date()),
      );
      throw error;
    }
  }
}

async function applySubscriptionEvent(
  transaction: PersistenceTransaction,
  event: NormalizedBillingProviderEvent,
): Promise<void> {
  const existing = event.providerSubscriptionId
    ? await transaction.billingSubscriptions.findByProviderSubscriptionId(
        event.provider,
        event.providerSubscriptionId,
      )
    : null;
  const userId = event.userId ?? existing?.userId;
  const providerSubscriptionId = event.providerSubscriptionId ?? existing?.providerSubscriptionId;
  const providerCustomerId = event.providerCustomerId ?? existing?.providerCustomerId;
  const planKey = event.planKey ?? existing?.planKey;
  const currentPeriodStart = event.currentPeriodStart ?? existing?.currentPeriodStart;
  const currentPeriodEnd = event.currentPeriodEnd ?? existing?.currentPeriodEnd;
  const status = subscriptionStatusForEvent(event, existing);

  if (
    !userId ||
    !providerSubscriptionId ||
    !providerCustomerId ||
    !planKey ||
    !currentPeriodStart ||
    !currentPeriodEnd ||
    !status
  ) {
    throw new ApplicationError(
      "validation",
      `Billing event ${event.providerEventId} is missing subscription identity or period data`,
    );
  }

  await transaction.billingSubscriptions.upsert({
    userId,
    provider: event.provider,
    providerCustomerId,
    providerSubscriptionId,
    planKey,
    status,
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd:
      event.cancelAtPeriodEnd ??
      (event.eventType === "subscription_paid" ? false : (existing?.cancelAtPeriodEnd ?? false)),
    updatedAt: event.receivedAt,
  });

  if (event.eventType !== "subscription_paid") return;

  await transaction.credits.ensureGrant({
    userId,
    sourceType: "subscription_cycle",
    idempotencyKey: `subscription:${event.provider}:${
      event.providerTransactionId ?? event.providerEventId
    }`,
    amount: subscriptionMonthlyCreditAmount,
    validFrom: currentPeriodStart,
    expiresAt: currentPeriodEnd,
    metadata: {
      provider: event.provider,
      providerEventId: event.providerEventId,
      providerSubscriptionId,
      providerTransactionId: event.providerTransactionId,
      planKey,
    },
    createdAt: event.receivedAt,
  });
}

function subscriptionStatusForEvent(
  event: NormalizedBillingProviderEvent,
  existing: BillingSubscription | null,
): BillingSubscription["status"] | undefined {
  const statuses: Partial<
    Record<NormalizedBillingProviderEvent["eventType"], BillingSubscription["status"]>
  > = {
    subscription_active: "active",
    subscription_canceled: "canceled",
    subscription_expired: "expired",
    subscription_paid: "active",
    subscription_past_due: "past_due",
    subscription_scheduled_cancel: "active",
  };
  return statuses[event.eventType] ?? event.status ?? existing?.status;
}
