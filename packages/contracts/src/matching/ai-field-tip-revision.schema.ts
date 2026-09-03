import { z } from "zod";

/**
 * Output schema for the single-field apply-tip AI call (see ApplyDocumentFieldTipUseCase). Lenient
 * like the other AI-facing schemas in this file: an empty string should fall back to the caller's
 * current text rather than fail the whole request.
 */
export const aiFieldTipRevisionSchema = z.object({
  revisedText: z.string(),
});

export type AiFieldTipRevisionDto = z.infer<typeof aiFieldTipRevisionSchema>;
