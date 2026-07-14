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

export type AiMatchResultDto = z.infer<typeof aiMatchResultSchema>;
