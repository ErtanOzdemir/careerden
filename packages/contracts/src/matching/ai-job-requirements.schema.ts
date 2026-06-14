import { z } from "zod";

export const aiJobRequirementsSchema = z.object({
  requirements: z.array(z.string().trim().min(1).max(180)).min(1).max(40),
});

export type AiJobRequirementsDto = z.infer<typeof aiJobRequirementsSchema>;
