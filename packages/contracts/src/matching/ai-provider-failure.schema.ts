import { z } from "zod";

export const aiProviderFailureCategories = [
  // 401/403, or the provider says the key is wrong or revoked.
  "invalid_api_key",
  // 402, or the provider reports an empty balance or exhausted quota.
  "insufficient_quota",
  // 429 without a balance problem.
  "rate_limited",
  // 404, or the provider says the model does not exist.
  "model_unavailable",
  // 5xx, timeouts, and network failures.
  "provider_unavailable",
  // The model answered, but the answer failed the output schema.
  "invalid_output",
] as const;

export const aiProviderFailureCategorySchema = z.enum(aiProviderFailureCategories);

// `aiFailure` on a job application and on its "AI analysis failed" timeline event.
export const aiProviderFailureSchema = z.object({
  category: aiProviderFailureCategorySchema,
  provider: z.string().max(40).optional(),
  statusCode: z.number().int().min(100).max(599).optional(),
});

export type AiProviderFailureDto = z.infer<typeof aiProviderFailureSchema>;
