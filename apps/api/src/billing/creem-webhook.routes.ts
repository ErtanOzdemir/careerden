import express, { Router } from "express";
import type { Router as ExpressRouter } from "express";
import type { ProcessBillingProviderEventUseCase } from "@careerden/application";
import type { CreemWebhookEventParser } from "@careerden/infrastructure";
import { CreemWebhookSignatureError } from "@careerden/infrastructure";

export function createCreemWebhookRouter(dependencies: {
  parser: Pick<CreemWebhookEventParser, "parseAndVerify">;
  processEvent: Pick<ProcessBillingProviderEventUseCase, "execute">;
}) {
  const router: ExpressRouter = Router();

  router.post(
    "/",
    express.raw({ type: "application/json", limit: "1mb" }),
    async (request, response, next) => {
      try {
        if (!Buffer.isBuffer(request.body)) {
          response.status(400).json({ code: "validation", error: "Webhook body must be JSON" });
          return;
        }
        const signatureHeader = request.header("creem-signature");
        const event = dependencies.parser.parseAndVerify(request.body, signatureHeader);
        const result = await dependencies.processEvent.execute(event);
        response.json({ received: true, processed: result.processed });
      } catch (error) {
        if (error instanceof CreemWebhookSignatureError) {
          response.status(401).json({ code: "unauthorized", error: "Invalid webhook signature" });
          return;
        }
        if (error instanceof SyntaxError) {
          response.status(400).json({ code: "validation", error: "Invalid webhook JSON" });
          return;
        }
        next(error);
      }
    },
  );

  return router;
}
