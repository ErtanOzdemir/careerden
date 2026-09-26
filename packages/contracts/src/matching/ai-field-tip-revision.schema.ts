import { z } from "zod";

/**
 * One structural block of a CV field as exchanged with the AI: a run of paragraphs, a bullet list, or
 * a numbered list. `lines` holds one paragraph or one list item per entry, without list markers.
 * Kept flat (no discriminated union) so every provider's structured-output mode accepts it.
 */
export const aiFieldTipRevisionBlockSchema = z.object({
  kind: z.enum(["paragraphs", "bullets", "numbered"]),
  lines: z.array(z.string()),
});

/**
 * Output schema for the single-field apply-tip AI call (see ApplyDocumentFieldTipUseCase). Lenient
 * like the other AI-facing schemas in this file: empty blocks should fall back to the caller's
 * current value rather than fail the whole request.
 */
export const aiFieldTipRevisionSchema = z.object({
  blocks: z.array(aiFieldTipRevisionBlockSchema),
});

export type AiFieldTipRevisionBlockDto = z.infer<typeof aiFieldTipRevisionBlockSchema>;
export type AiFieldTipRevisionDto = z.infer<typeof aiFieldTipRevisionSchema>;
