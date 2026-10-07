import { z } from "zod";
import { documentContentSchema } from "./rich-document.schema.js";

/** The unsaved CV draft the cover letter should be rewritten from. */
export const rewriteCoverLetterRequestSchema = z
  .object({
    documentContent: documentContentSchema,
  })
  .strict();

export type RewriteCoverLetterRequestDto = z.infer<typeof rewriteCoverLetterRequestSchema>;
