import { z } from "zod";

export const aiMatchResultSchema = z.object({
  coverLetterContent: z.string().min(1),
  matchScore: z.number().int().min(0).max(100),
  requirementEvaluations: z
    .array(
      z.object({
        requirement: z.string().min(1),
        status: z.enum(["matched", "partial", "missing"]),
        evidence: z.array(z.string().min(1)),
      }),
    )
    .optional(),
  missingSkills: z.array(z.string().min(1)),
  missingSkillResources: z
    .array(
      z.object({
        skill: z.string().min(1),
        title: z.string().min(1),
        url: z.string().url(),
        type: z.enum(["documentation", "tutorial", "article", "video", "other"]),
        reason: z.string().min(1),
      }),
    )
    .optional(),
  strongSkills: z.array(z.string().min(1)),
  recommendedAchievements: z.array(z.string().min(1)),
  customizedSummary: z.string().min(1),
  interviewTips: z.array(z.string().min(1)),
  coverLetterGuidance: z.array(z.string().min(1)).optional(),
  experienceEnhancements: z
    .array(
      z.object({
        experienceIndex: z.number().int().min(0),
        enhancedDescription: z.string().min(1),
      }),
    )
    .optional(),
  skillSuggestions: z.array(z.string().min(1)).optional(),
  educationEnhancements: z
    .array(
      z.object({
        educationIndex: z.number().int().min(0),
        enhancedDescription: z.string().min(1),
      }),
    )
    .optional(),
  projectEnhancements: z
    .array(
      z.object({
        projectIndex: z.number().int().min(0),
        enhancedDescription: z.string().min(1),
      }),
    )
    .optional(),
  certificationSuggestions: z.array(z.string().min(1)).optional(),
});

/**
 * Lenient mirror of {@link aiMatchResultSchema}, and the schema that must be handed to the AI
 * provider. `Output.object({ schema })` makes the AI SDK validate the model's JSON *inside*
 * `generateText`, so a strict schema turns a single empty string or a malformed URL into a hard
 * generation failure that costs the whole analysis. Validate leniently here, repair and fill in the
 * use case, then gate on `aiMatchResultSchema` before persisting.
 *
 * Completeness is deliberately not expressed here: requiring one enhancement per profile index at
 * this boundary would turn "the model skipped index 3" into the same unrecoverable failure. See
 * complete-enhancements.ts for the enforcement that can actually repair.
 */
export const aiMatchResultCandidateSchema = z.object({
  coverLetterContent: z.string(),
  matchScore: z.number(),
  requirementEvaluations: z
    .array(
      z.object({
        requirement: z.string(),
        status: z.enum(["matched", "partial", "missing"]),
        evidence: z.array(z.string()),
      }),
    )
    .optional(),
  missingSkills: z.array(z.string()),
  missingSkillResources: z
    .array(
      z.object({
        skill: z.string(),
        title: z.string(),
        url: z.string(),
        type: z.enum(["documentation", "tutorial", "article", "video", "other"]),
        reason: z.string(),
      }),
    )
    .optional(),
  strongSkills: z.array(z.string()),
  recommendedAchievements: z.array(z.string()),
  customizedSummary: z.string(),
  interviewTips: z.array(z.string()),
  coverLetterGuidance: z.array(z.string()).optional(),
  experienceEnhancements: z
    .array(
      z.object({
        experienceIndex: z.number(),
        enhancedDescription: z.string(),
      }),
    )
    .optional(),
  skillSuggestions: z.array(z.string()).optional(),
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
  certificationSuggestions: z.array(z.string()).optional(),
});

export type AiMatchResultDto = z.infer<typeof aiMatchResultSchema>;
export type AiMatchResultCandidateDto = z.infer<typeof aiMatchResultCandidateSchema>;
