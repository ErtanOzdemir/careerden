import { z } from "zod";

export const billingRedirectSchema = z
  .object({
    url: z.string().url(),
  })
  .strict();

export const billingSubscriptionSchema = z
  .object({
    provider: z.string().min(1),
    planKey: z.string().min(1),
    status: z.enum(["active", "past_due", "canceled", "expired"]),
    currentPeriodStart: z.string().datetime(),
    currentPeriodEnd: z.string().datetime(),
    cancelAtPeriodEnd: z.boolean(),
  })
  .strict();

export const billingSubscriptionResponseSchema = billingSubscriptionSchema.nullable();

export type BillingRedirect = z.infer<typeof billingRedirectSchema>;
export type BillingSubscriptionResponse = z.infer<typeof billingSubscriptionResponseSchema>;
