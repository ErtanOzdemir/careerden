import { z } from "zod";

const cvTipSchema = z.object({
  text: z.string().min(1),
  requirement: z.string().min(1).optional(),
  evidence: z.string().min(1).optional(),
});

const cvListTipSchema = z.object({
  item: z.string().min(1).max(80),
  text: z.string().min(1),
  requirement: z.string().min(1).optional(),
});

const gapQuestionSchema = z.object({
  question: z.string().min(1),
  requirement: z.string().min(1).optional(),
  field: z.discriminatedUnion("type", [
    z.object({ type: z.literal("summary") }),
    z.object({
      type: z.enum(["experience", "education", "project"]),
      index: z.number().int().min(0),
    }),
  ]),
});

/** Flat AI-facing form of a gap question; `fieldIndex` is ignored for the summary. */
const gapQuestionCandidateSchema = z.object({
  question: z.string(),
  requirement: z.string(),
  fieldType: z.enum(["summary", "experience", "education", "project"]),
  fieldIndex: z.number(),
});

/**
 * AI-facing tip shapes. Every field is required (empty string for "none") so the schema stays
 * compatible with strict structured-output modes; normalization turns empty strings into absent
 * fields and drops unverifiable requirement/evidence links.
 */
const cvTipCandidateSchema = z.object({
  text: z.string(),
  requirement: z.string(),
  evidence: z.string(),
});

const cvListTipCandidateSchema = z.object({
  item: z.string(),
  text: z.string(),
  requirement: z.string(),
});

export const aiMatchResultSchema = z.object({
  coverLetterContent: z.string().min(1),
  matchScore: z.number().int().min(0).max(100),
  requirementEvaluations: z
    .array(
      z.object({
        requirement: z.string().min(1),
        status: z.enum(["matched", "partial", "missing"]),
        evidence: z.array(z.string().min(1)),
        priority: z.enum(["must", "nice"]).optional(),
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
  summaryTips: z.array(cvTipSchema),
  interviewTips: z.array(z.string().min(1)),
  coverLetterGuidance: z.array(z.string().min(1)).optional(),
  experienceTips: z
    .array(
      z.object({
        experienceIndex: z.number().int().min(0),
        tips: z.array(cvTipSchema),
      }),
    )
    .optional(),
  skillsTips: z.array(cvListTipSchema).optional(),
  educationTips: z
    .array(
      z.object({
        educationIndex: z.number().int().min(0),
        tips: z.array(cvTipSchema),
      }),
    )
    .optional(),
  projectTips: z
    .array(
      z.object({
        projectIndex: z.number().int().min(0),
        tips: z.array(cvTipSchema),
      }),
    )
    .optional(),
  certificationsTips: z.array(cvListTipSchema).optional(),
  gapQuestions: z.array(gapQuestionSchema).max(5).optional(),
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
        priority: z.enum(["must", "nice"]).optional(),
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
  summaryTips: z.array(cvTipCandidateSchema),
  interviewTips: z.array(z.string()),
  coverLetterGuidance: z.array(z.string()).optional(),
  experienceTips: z
    .array(
      z.object({
        experienceIndex: z.number(),
        tips: z.array(cvTipCandidateSchema),
      }),
    )
    .optional(),
  skillsTips: z.array(cvListTipCandidateSchema).optional(),
  educationTips: z
    .array(
      z.object({
        educationIndex: z.number(),
        tips: z.array(cvTipCandidateSchema),
      }),
    )
    .optional(),
  projectTips: z
    .array(
      z.object({
        projectIndex: z.number(),
        tips: z.array(cvTipCandidateSchema),
      }),
    )
    .optional(),
  certificationsTips: z.array(cvListTipCandidateSchema).optional(),
  gapQuestions: z.array(gapQuestionCandidateSchema).optional(),
});

export type AiMatchResultDto = z.infer<typeof aiMatchResultSchema>;
export type AiMatchResultCandidateDto = z.infer<typeof aiMatchResultCandidateSchema>;
