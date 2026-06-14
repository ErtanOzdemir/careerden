import { z } from "zod";

export const aiMatchResultSchema = z.object({
  matchScore: z.number().int().min(0).max(100),
  missingSkills: z.array(z.string().min(1)),
  strongSkills: z.array(z.string().min(1)),
  recommendedAchievements: z.array(z.string().min(1)),
  customizedSummary: z.string().min(1),
  interviewTips: z.array(z.string().min(1)),
  coverLetterGuidance: z.array(z.string().min(1)).optional(),
});

export type AiMatchResultDto = z.infer<typeof aiMatchResultSchema>;
