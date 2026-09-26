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

const tipLinksSchema = {
  /** The job requirement the tip addresses, as linked by the match analysis. */
  requirement: z.string().min(1).max(500).optional(),
  /** Profile phrase the tip relies on; re-verified against the profile before it is used. */
  evidence: z.string().min(1).max(1_000).optional(),
};

export const applyFieldTipRequestSchema = z
  .object({
    field: applyFieldTipFieldRefSchema,
    currentValue: richDocumentSchema,
    tip: z.string().min(1).max(2_000),
    ...tipLinksSchema,
    /** Further tips for the same field, applied together with `tip` in one revision. */
    additionalTips: z
      .array(z.object({ tip: z.string().min(1).max(2_000), ...tipLinksSchema }).strict())
      .max(5)
      .optional(),
    /**
     * The candidate's own answer when `tip` is a gap question. It is their statement about their
     * experience, so it may ground new content that is not in the profile yet.
     */
    candidateAnswer: z.string().trim().min(1).max(2_000).optional(),
  })
  .strict();

export type ApplyFieldTipRequestDto = z.infer<typeof applyFieldTipRequestSchema>;
export type ApplyFieldTipFieldRef = z.infer<typeof applyFieldTipFieldRefSchema>;
