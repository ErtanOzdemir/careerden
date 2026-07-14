import { z } from "zod";
import { documentContentSchema } from "./rich-document.schema.js";

const bcp47LanguageSchema = z
  .string()
  .regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/, "Expected auto or a BCP-47 language tag");

export const applicationPackToneSchema = z.enum(["professional", "concise", "creative"]);

export const applicationPackPreferencesSchema = z
  .object({
    language: z.union([z.literal("auto"), bcp47LanguageSchema]).default("auto"),
    tone: applicationPackToneSchema.default("professional"),
    cvTemplateId: z.string().min(1).optional(),
    coverLetterTemplateId: z.string().min(1).optional(),
  })
  .strict();

export type ApplicationPackPreferencesDto = z.infer<typeof applicationPackPreferencesSchema>;

export const requestApplicationPackGenerationSchema = z
  .object({
    documentContent: documentContentSchema.optional(),
    preferences: applicationPackPreferencesSchema.optional(),
  })
  .strict()
  .default({});

export type RequestApplicationPackGenerationDto = z.infer<
  typeof requestApplicationPackGenerationSchema
>;
