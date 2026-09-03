import { z } from "zod";
import { richDocumentSchema } from "./rich-document.schema.js";

/**
 * Only prose fields go through AI regeneration. Skills/certifications tips suggest a specific item
 * to add and are applied as a plain client-side list append — no AI call, so no schema needed here.
 */
export const applyFieldTipFieldRefSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("summary") }).strict(),
  z.object({ type: z.literal("experience"), index: z.number().int().min(0) }).strict(),
  z.object({ type: z.literal("education"), index: z.number().int().min(0) }).strict(),
  z.object({ type: z.literal("project"), index: z.number().int().min(0) }).strict(),
]);

export const applyFieldTipRequestSchema = z
  .object({
    field: applyFieldTipFieldRefSchema,
    currentValue: richDocumentSchema,
    tip: z.string().min(1).max(2_000),
  })
  .strict();

export type ApplyFieldTipRequestDto = z.infer<typeof applyFieldTipRequestSchema>;
export type ApplyFieldTipFieldRef = z.infer<typeof applyFieldTipFieldRefSchema>;
