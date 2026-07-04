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

const selectedExperienceFieldsSchema = z
  .object({
    company: templateVariableNameSchema.optional(),
    description: templateVariableNameSchema.optional(),
    end_date: templateVariableNameSchema.optional(),
    period: templateVariableNameSchema.optional(),
    start_date: templateVariableNameSchema.optional(),
    title: templateVariableNameSchema.optional(),
  })
  .strict();

const selectedEducationFieldsSchema = z
  .object({
    degree: templateVariableNameSchema.optional(),
    end_date: templateVariableNameSchema.optional(),
    field: templateVariableNameSchema.optional(),
    institution: templateVariableNameSchema.optional(),
    period: templateVariableNameSchema.optional(),
    start_date: templateVariableNameSchema.optional(),
  })
  .strict();

const selectedProjectFieldsSchema = z
  .object({
    description: templateVariableNameSchema.optional(),
    name: templateVariableNameSchema.optional(),
    url: templateVariableNameSchema.optional(),
  })
  .strict();

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
      fields: selectedEducationFieldsSchema.default({}),
      items: z
        .array(
          z.object({
            fields: selectedEducationFieldsSchema.default({}),
          }),
        )
        .optional(),
    })
    .optional(),
  selectedExperiences: z
    .object({
      fields: selectedExperienceFieldsSchema.default({}),
      items: z
        .array(
          z.object({
            fields: selectedExperienceFieldsSchema.default({}),
          }),
        )
        .optional(),
    })
    .optional(),
  selectedProjects: z
    .object({
      fields: selectedProjectFieldsSchema.default({}),
      items: z
        .array(
          z.object({
            fields: selectedProjectFieldsSchema.default({}),
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
