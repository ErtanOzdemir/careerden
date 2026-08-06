import { z } from "zod";

/**
 * Output schema for the single repair call made when the first analysis left profile items without
 * a tailored description. Lenient for the same reason as `aiMatchResultCandidateSchema`: the repair
 * exists to rescue an under-delivered response, so it must never fail generation itself.
 */
export const aiEnhancementRepairSchema = z.object({
  experienceEnhancements: z
    .array(
      z.object({
        experienceIndex: z.number(),
        enhancedDescription: z.string(),
      }),
    )
    .optional(),
  educationEnhancements: z
    .array(
      z.object({
        educationIndex: z.number(),
        enhancedDescription: z.string(),
      }),
    )
    .optional(),
  projectEnhancements: z
    .array(
      z.object({
        projectIndex: z.number(),
        enhancedDescription: z.string(),
      }),
    )
    .optional(),
});

export type AiEnhancementRepairDto = z.infer<typeof aiEnhancementRepairSchema>;
