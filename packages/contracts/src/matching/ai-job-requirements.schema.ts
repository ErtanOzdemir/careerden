import { z } from "zod";

const aiJobRequirementSchema = z.string().trim().min(1).max(180);

export const aiJobRequirementsCandidateSchema = z.object({
  requirements: z.array(aiJobRequirementSchema).max(40),
});

export const aiJobRequirementsSchema = z.object({
  requirements: z.array(aiJobRequirementSchema).min(1).max(40),
});

export type AiJobRequirementsCandidateDto = z.infer<typeof aiJobRequirementsCandidateSchema>;
export type AiJobRequirementsDto = z.infer<typeof aiJobRequirementsSchema>;
