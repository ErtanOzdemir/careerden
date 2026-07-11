import { z } from "zod";

export const apiErrorCodeSchema = z.enum([
  "conflict",
  "forbidden",
  "internal",
  "not_found",
  "unauthorized",
  "validation",
]);

export const apiErrorResponseSchema = z
  .object({
    code: apiErrorCodeSchema,
    error: z.string(),
    issues: z.array(z.unknown()).optional(),
    traceId: z.string().optional(),
  })
  .passthrough();

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
