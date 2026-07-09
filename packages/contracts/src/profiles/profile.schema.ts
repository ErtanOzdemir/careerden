import { z } from "zod";

export const profileExperienceSchema = z.object({
  company: z.string().min(1),
  title: z.string().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  description: z.string().optional(),
});

export const profileEducationSchema = z.object({
  institution: z.string().min(1),
  degree: z.string().optional(),
  field: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const profileProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  url: z.string().url().optional(),
  skills: z.array(z.string().min(1)).default([]),
  achievements: z.array(z.string().min(1)).default([]),
});

export const createProfileSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  autoRunMatchAnalysis: z.boolean().default(true),
  followUpRemindersEnabled: z.boolean().default(true),
  profession: z.string().optional(),
  headline: z.string().optional(),
  location: z.string().optional(),
  links: z.array(z.string().url()).default([]),
  summary: z.string().optional(),
  skills: z.array(z.string().min(1)).default([]),
  experience: z.array(profileExperienceSchema).default([]),
  education: z.array(profileEducationSchema).default([]),
  certifications: z.array(z.string().min(1)).default([]),
  projects: z.array(profileProjectSchema).default([]),
});

export const updateProfileSchema = createProfileSchema.partial();

export type CreateProfileDto = z.infer<typeof createProfileSchema>;
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
