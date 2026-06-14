import { z } from "zod";

export const linkedinSessionStatusSchema = z.object({
  status: z.enum(["missing", "login_in_progress", "connected", "expired"]),
  message: z.string().optional(),
  updatedAt: z.string().optional()
});

export type LinkedInSessionStatusDto = z.infer<typeof linkedinSessionStatusSchema>;
