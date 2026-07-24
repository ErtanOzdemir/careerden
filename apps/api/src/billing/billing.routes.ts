import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import type { GetCreditBalanceUseCase } from "@careerden/application";
import { creditBalanceSchema } from "@careerden/contracts";
import type { AuthenticatedRequest } from "../auth/session.middleware.js";

export function createBillingRouter(dependencies: {
  getCreditBalance: Pick<GetCreditBalanceUseCase, "execute">;
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

  return router;
}
