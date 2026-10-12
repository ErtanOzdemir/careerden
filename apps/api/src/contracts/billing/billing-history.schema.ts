import { z } from "zod";

const minorAmountSchema = z.number().int().nonnegative();

export const billingPaymentSchema = z
  .object({
    id: z.string().min(1),
    status: z.enum([
      "pending",
      "paid",
      "refunded",
      "partially_refunded",
      "charged_back",
      "failed",
      "canceled",
    ]),
    currency: z.string().length(3),
    amountMinor: minorAmountSchema,
    amountPaidMinor: minorAmountSchema.optional(),
    refundedAmountMinor: minorAmountSchema.optional(),
    taxAmountMinor: minorAmountSchema.optional(),
    periodStart: z.string().datetime().optional(),
    periodEnd: z.string().datetime().optional(),
    createdAt: z.string().datetime(),
  })
  .strict();

export const billingPaymentsResponseSchema = z
  .object({ items: z.array(billingPaymentSchema) })
  .strict();

export const creditActivitySchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(["free_monthly_grant", "subscription_grant", "analysis_usage"]),
    delta: z.number().int(),
    occurredAt: z.string().datetime(),
    jobApplication: z
      .object({
        id: z.string().min(1),
        deleted: z.boolean(),
        roleTitle: z.string().optional(),
        companyName: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const creditActivityResponseSchema = z
  .object({ items: z.array(creditActivitySchema) })
  .strict();

export type BillingPaymentsResponse = z.infer<typeof billingPaymentsResponseSchema>;
export type CreditActivityResponse = z.infer<typeof creditActivityResponseSchema>;
