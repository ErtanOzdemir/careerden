import { z } from "zod";
import { aiFieldTipRevisionBlockSchema } from "../matching/ai-field-tip-revision.schema.js";
import {
  profileEducationSchema,
  profileExperienceSchema,
  profileProjectSchema,
} from "./profile.schema.js";

/**
 * AI-facing CV extraction shape. Every field is required (empty string or empty list for "not in
 * the CV") so the schema stays compatible with strict structured-output modes; the extraction use
 * case trims, validates, and drops empty values afterwards. Descriptions use the same paragraph and
 * list blocks as field tips so CV bullet points stay bullet points.
 */
export const aiCvExtractionSchema = z.object({
  fullName: z.string(),
  email: z.string(),
  profession: z.string(),
  headline: z.string(),
  location: z.string(),
  links: z.array(z.string()),
  summary: z.string(),
  skills: z.array(z.string()),
  certifications: z.array(z.string()),
  experience: z.array(
    z.object({
      company: z.string(),
      title: z.string(),
      startDate: z.string(),
      endDate: z.string(),
      description: z.array(aiFieldTipRevisionBlockSchema),
    }),
  ),
  education: z.array(
    z.object({
      institution: z.string(),
      degree: z.string(),
      field: z.string(),
      startDate: z.string(),
      endDate: z.string(),
      description: z.array(aiFieldTipRevisionBlockSchema),
    }),
  ),
  projects: z.array(
    z.object({
      name: z.string(),
      url: z.string(),
      skills: z.array(z.string()),
      description: z.array(aiFieldTipRevisionBlockSchema),
    }),
  ),
});

export type AiCvExtractionDto = z.infer<typeof aiCvExtractionSchema>;

/** The reviewed draft the user applies, holding only the sections they kept. */
export const applyProfileImportSchema = z
  .object({
    fullName: z.string().min(1).optional(),
    email: z.string().email().optional(),
    profession: z.string().min(1).optional(),
    headline: z.string().min(1).optional(),
    location: z.string().min(1).optional(),
    links: z.array(z.string().url()).optional(),
    summary: z.string().min(1).optional(),
    skills: z.array(z.string().min(1)).optional(),
    certifications: z.array(z.string().min(1)).optional(),
    experience: z.array(profileExperienceSchema).optional(),
    education: z.array(profileEducationSchema).optional(),
    projects: z.array(profileProjectSchema).optional(),
  })
  .strict();

export type ApplyProfileImportDto = z.infer<typeof applyProfileImportSchema>;
