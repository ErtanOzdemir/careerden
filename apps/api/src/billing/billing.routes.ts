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
import type { AuthenticatedRequest } from "../auth/session.middleware.js";

export function createBillingRouter(dependencies: {
  getCreditBalance: Pick<GetCreditBalanceUseCase, "execute">;
  getBillingSubscription: Pick<GetBillingSubscriptionUseCase, "execute">;
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
