import { z } from "zod";

export const documentTemplateFieldSchema = z.enum([
  "certifications",
  "company_name",
  "customized_summary",
  "education_list",
  "email",
  "experience_list",
  "full_name",
  "headline",
  "job_description",
  "job_location",
  "links",
  "location",
  "missing_skills",
  "profession",
  "projects",
  "recommended_achievements",
  "role_title",
  "selected_education",
  "selected_experiences",
  "selected_projects",
  "skills",
  "strong_skills",
  "summary",
]);

export const updateDocumentTemplateMappingsSchema = z.object({
  fieldMappings: z.record(z.string().min(1), documentTemplateFieldSchema),
});

const templateVariableNameSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Use letters, numbers, and underscores; start with a letter");

const selectedExperienceFieldSchema = z.enum([
  "achievements",
  "company",
  "description",
  "end_date",
  "period",
  "skills",
  "start_date",
  "title",
]);

const selectedEducationFieldSchema = z.enum([
  "achievements",
  "degree",
  "end_date",
  "field",
  "institution",
  "period",
  "start_date",
]);

const selectedProjectFieldSchema = z.enum(["achievements", "description", "name", "skills", "url"]);

export const documentTemplateVariableAliasesSchema = z.object({
  fields: z.record(documentTemplateFieldSchema, templateVariableNameSchema.optional()).default({}),
  certificationItems: z
    .array(
      z.object({
        variableName: templateVariableNameSchema.optional(),
      }),
    )
    .optional(),
  linkItems: z
    .array(
      z.object({
        variableName: templateVariableNameSchema.optional(),
      }),
    )
    .optional(),
  selectedEducation: z
    .object({
      fields: z
        .record(selectedEducationFieldSchema, templateVariableNameSchema.optional())
        .default({}),
      items: z
        .array(
          z.object({
            fields: z
              .record(selectedEducationFieldSchema, templateVariableNameSchema.optional())
              .default({}),
          }),
        )
        .optional(),
    })
    .optional(),
  selectedExperiences: z
    .object({
      fields: z
        .record(selectedExperienceFieldSchema, templateVariableNameSchema.optional())
        .default({}),
      items: z
        .array(
          z.object({
            fields: z
              .record(selectedExperienceFieldSchema, templateVariableNameSchema.optional())
              .default({}),
          }),
        )
        .optional(),
    })
    .optional(),
  selectedProjects: z
    .object({
      fields: z
        .record(selectedProjectFieldSchema, templateVariableNameSchema.optional())
        .default({}),
      items: z
        .array(
          z.object({
            fields: z
              .record(selectedProjectFieldSchema, templateVariableNameSchema.optional())
              .default({}),
          }),
        )
        .optional(),
    })
    .optional(),
});

export const updateDocumentTemplateVariableAliasesSchema = z.object({
  variableAliases: documentTemplateVariableAliasesSchema,
});

export type DocumentTemplateFieldDto = z.infer<typeof documentTemplateFieldSchema>;
export type UpdateDocumentTemplateMappingsDto = z.infer<
  typeof updateDocumentTemplateMappingsSchema
>;
export type UpdateDocumentTemplateVariableAliasesDto = z.infer<
  typeof updateDocumentTemplateVariableAliasesSchema
>;
