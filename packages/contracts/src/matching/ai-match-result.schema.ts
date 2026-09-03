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
  summaryTips: z.array(z.string().min(1)),
  interviewTips: z.array(z.string().min(1)),
  coverLetterGuidance: z.array(z.string().min(1)).optional(),
  experienceTips: z
    .array(
      z.object({
        experienceIndex: z.number().int().min(0),
        tips: z.array(z.string().min(1)),
      }),
    )
    .optional(),
  skillsTips: z.array(z.string().min(1)).optional(),
  educationTips: z
    .array(
      z.object({
        educationIndex: z.number().int().min(0),
        tips: z.array(z.string().min(1)),
      }),
    )
    .optional(),
  projectTips: z
    .array(
      z.object({
        projectIndex: z.number().int().min(0),
        tips: z.array(z.string().min(1)),
      }),
    )
    .optional(),
  certificationsTips: z.array(z.string().min(1)).optional(),
});

/**
 * Lenient mirror of {@link aiMatchResultSchema}, and the schema that must be handed to the AI
 * provider. `Output.object({ schema })` makes the AI SDK validate the model's JSON *inside*
 * `generateText`, so a strict schema turns a single empty string or a malformed URL into a hard
 * generation failure that costs the whole analysis. Validate leniently here, then fill in any
 * missing per-item entries (structurally, not via a second AI call — see complete-enhancements.ts)
 * before gating on `aiMatchResultSchema` and persisting.
 *
 * Completeness is deliberately not expressed here: requiring one entry per profile index at this
 * boundary would turn "the model skipped index 3" into an unrecoverable failure. Unlike the old
 * full-rewrite design, an empty `tips` array is a legitimate outcome (nothing to suggest), so
 * "completeness" now only means array-length reconciliation, not non-empty content.
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
  summaryTips: z.array(z.string()),
  interviewTips: z.array(z.string()),
  coverLetterGuidance: z.array(z.string()).optional(),
  experienceTips: z
    .array(
      z.object({
        experienceIndex: z.number(),
        tips: z.array(z.string()),
      }),
    )
    .optional(),
  skillsTips: z.array(z.string()).optional(),
  educationTips: z
    .array(
      z.object({
        educationIndex: z.number(),
        tips: z.array(z.string()),
      }),
    )
    .optional(),
  projectTips: z
    .array(
      z.object({
        projectIndex: z.number(),
        tips: z.array(z.string()),
      }),
    )
    .optional(),
  certificationsTips: z.array(z.string()).optional(),
});

export type AiMatchResultDto = z.infer<typeof aiMatchResultSchema>;
export type AiMatchResultCandidateDto = z.infer<typeof aiMatchResultCandidateSchema>;
