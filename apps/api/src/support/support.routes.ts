import { Router } from "express";
import type { Request, Router as ExpressRouter } from "express";
import type { SubmitSupportRequestUseCase } from "../application/support/submit-support-request.use-case.js";
import {
  submitSupportRequestSchema,
  type SubmitSupportRequestDto,
} from "../contracts/support/support-request.schema.js";
import type { AuthenticatedRequest } from "../auth/session.middleware.js";
import { validateBody } from "../middleware/validate-body.js";

export function createSupportRouter(dependencies: {
  submitSupportRequest: SubmitSupportRequestUseCase;
}) {
  const router: ExpressRouter = Router();

  router.post(
    "/requests",
    validateBody(submitSupportRequestSchema),
    async (request, response, next) => {
      try {
        const body = request.body as SubmitSupportRequestDto;
        await dependencies.submitSupportRequest.execute({
          user: currentUser(request),
          reason: body.reason,
          description: body.description,
        });
        response.status(202).json({ accepted: true });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}

function currentUser(request: Request): AuthenticatedRequest["user"] {
  return (request as AuthenticatedRequest).user;
}
