import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import type { GetCreditBalanceUseCase } from "../application/billing/get-credit-balance.use-case.js";
import type { CreateBillingPortalUseCase } from "../application/billing/create-billing-portal.use-case.js";
import type { CreateSubscriptionCheckoutUseCase } from "../application/billing/create-subscription-checkout.use-case.js";
import type { GetBillingSubscriptionUseCase } from "../application/billing/get-billing-subscription.use-case.js";
import {
  billingRedirectSchema,
  billingSubscriptionResponseSchema,
} from "../contracts/billing/billing-subscription.schema.js";
import { creditBalanceSchema } from "../contracts/billing/credit-balance.schema.js";
import {
  billingPaymentsResponseSchema,
  creditActivityResponseSchema,
} from "../contracts/billing/billing-history.schema.js";
import type { ListBillingPaymentsUseCase } from "../application/billing/list-billing-payments.use-case.js";
import type { ListCreditActivityUseCase } from "../application/billing/list-credit-activity.use-case.js";
import type { AuthenticatedRequest } from "../auth/session.middleware.js";

export function createBillingRouter(dependencies: {
  getCreditBalance: Pick<GetCreditBalanceUseCase, "execute">;
  getBillingSubscription: Pick<GetBillingSubscriptionUseCase, "execute">;
  listCreditActivity: Pick<ListCreditActivityUseCase, "execute">;
  listPayments?: Pick<ListBillingPaymentsUseCase, "execute">;
  createCheckout?: Pick<CreateSubscriptionCheckoutUseCase, "execute">;
  createPortal?: Pick<CreateBillingPortalUseCase, "execute">;
}) {
  const router: ExpressRouter = Router();

  router.get("/credits", async (request, response, next) => {
    try {
      const userId = (request as AuthenticatedRequest).user.id;
      response.json(creditBalanceSchema.parse(await dependencies.getCreditBalance.execute(userId)));
    } catch (error) {
      next(error);
    }
  });

  router.get("/subscription", async (request, response, next) => {
    try {
      const userId = (request as AuthenticatedRequest).user.id;
      const subscription = await dependencies.getBillingSubscription.execute(userId);
      response.json(
        billingSubscriptionResponseSchema.parse(
          subscription
            ? {
                provider: subscription.provider,
                planKey: subscription.planKey,
                status: subscription.status,
                currentPeriodStart: subscription.currentPeriodStart.toISOString(),
                currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
                cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
              }
            : null,
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/credit-activity", async (request, response, next) => {
    try {
      const userId = (request as AuthenticatedRequest).user.id;
      const activity = await dependencies.listCreditActivity.execute(userId);
      response.json(
        creditActivityResponseSchema.parse({
          items: activity.map((entry) => ({
            id: entry.id,
            kind: entry.kind,
            delta: entry.delta,
            occurredAt: entry.occurredAt.toISOString(),
            ...(entry.jobApplication ? { jobApplication: entry.jobApplication } : {}),
          })),
        }),
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/payments", async (request, response, next) => {
    try {
      const userId = (request as AuthenticatedRequest).user.id;
      const payments = dependencies.listPayments
        ? await dependencies.listPayments.execute(userId)
        : [];
      response.json(
        billingPaymentsResponseSchema.parse({
          items: payments.map((payment) => ({
            id: payment.id,
            status: payment.status,
            currency: payment.currency,
            amountMinor: payment.amountMinor,
            amountPaidMinor: payment.amountPaidMinor,
            refundedAmountMinor: payment.refundedAmountMinor,
            taxAmountMinor: payment.taxAmountMinor,
            periodStart: payment.periodStart?.toISOString(),
            periodEnd: payment.periodEnd?.toISOString(),
            createdAt: payment.createdAt.toISOString(),
          })),
        }),
      );
    } catch (error) {
      next(error);
    }
  });

  if (dependencies.createCheckout) {
    router.post("/checkout", async (request, response, next) => {
      try {
        const user = (request as AuthenticatedRequest).user;
        response.json(
          billingRedirectSchema.parse(
            await dependencies.createCheckout?.execute({
              id: user.id,
              email: user.email,
            }),
          ),
        );
      } catch (error) {
        next(error);
      }
    });
  }

  if (dependencies.createPortal) {
    router.post("/portal", async (request, response, next) => {
      try {
        const userId = (request as AuthenticatedRequest).user.id;
        response.json(
          billingRedirectSchema.parse(await dependencies.createPortal?.execute(userId)),
        );
      } catch (error) {
        next(error);
      }
    });
  }

  return router;
}
