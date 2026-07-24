import { z } from "zod";

const creditAmountSchema = z.number().int().nonnegative();

export const creditBalanceSchema = z
  .object({
    totalCredits: creditAmountSchema,
    availableCredits: creditAmountSchema,
    reservedCredits: creditAmountSchema,
  })
  .superRefine((balance, context) => {
    if (balance.totalCredits !== balance.availableCredits + balance.reservedCredits) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "totalCredits must equal availableCredits plus reservedCredits",
        path: ["totalCredits"],
      });
    }
  });

export type CreditBalanceDto = z.infer<typeof creditBalanceSchema>;
