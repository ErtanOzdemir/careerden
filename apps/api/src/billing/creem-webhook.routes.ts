import express, { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { rateLimit } from "express-rate-limit";
import type { ProcessBillingProviderEventUseCase } from "../application/billing/process-billing-provider-event.use-case.js";
import type { CreemWebhookEventParser } from "../infrastructure/billing/creem-webhook-event.parser.js";
import { CreemWebhookSignatureError } from "../infrastructure/billing/creem-webhook-event.parser.js";

/** Creem sends a few events per checkout; this caps a flood of forged deliveries. */
export const creemWebhookRateLimit = { limit: 120, windowMs: 60_000 };

export function createCreemWebhookRouter(dependencies: {
  parser: Pick<CreemWebhookEventParser, "parseAndVerify">;
  processEvent: Pick<ProcessBillingProviderEventUseCase, "execute">;
  rateLimit?: { limit: number; windowMs: number };
}) {
  const router: ExpressRouter = Router();

  router.post(
    "/",
    // One shared bucket: the API does not trust proxy headers, so every request behind the
    // reverse proxy has the same client address anyway. Creem retries deliveries that get a 429.
    rateLimit({
      ...(dependencies.rateLimit ?? creemWebhookRateLimit),
      keyGenerator: () => "creem-webhook",
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { code: "rate_limited", error: "Too many webhook requests" },
    }),
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
