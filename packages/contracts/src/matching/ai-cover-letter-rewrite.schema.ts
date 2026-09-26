import { z } from "zod";

/**
 * Output schema for rewriting the cover letter from the candidate's edited CV draft (see
 * RewriteCoverLetterUseCase). Lenient like the other AI-facing schemas: empty paragraphs are
 * dropped afterwards rather than failing the request.
 */
export const aiCoverLetterRewriteSchema = z.object({
  paragraphs: z.array(z.string()),
});

export type AiCoverLetterRewriteDto = z.infer<typeof aiCoverLetterRewriteSchema>;
