import { z } from "zod";

export const supportRequestReasonSchema = z.enum(["bug_report", "feature_request", "other"]);

export const submitSupportRequestSchema = z.object({
  reason: supportRequestReasonSchema,
  description: z.string().trim().min(10).max(5_000),
});

export const submitSupportRequestResultSchema = z.object({
  accepted: z.literal(true),
});

export type SupportRequestReasonDto = z.infer<typeof supportRequestReasonSchema>;
export type SubmitSupportRequestDto = z.infer<typeof submitSupportRequestSchema>;
export type SubmitSupportRequestResultDto = z.infer<typeof submitSupportRequestResultSchema>;
