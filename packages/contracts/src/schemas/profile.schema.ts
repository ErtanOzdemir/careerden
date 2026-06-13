import { z } from "zod";

export const profileExperienceSchema = z.object({
  company: z.string().min(1),
  title: z.string().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  achievements: z.array(z.string().min(1)).default([])
});

export const createProfileSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  headline: z.string().optional(),
  location: z.string().optional(),
  summary: z.string().optional(),
  skills: z.array(z.string().min(1)).default([]),
  experience: z.array(profileExperienceSchema).default([])
});

export type CreateProfileDto = z.infer<typeof createProfileSchema>;
