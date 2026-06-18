export type DocumentTemplateKind = "cv";
export type DocumentTemplateFormat = "docx";

export type DocumentTemplateField =
  | "company_name"
  | "customized_summary"
  | "education_list"
  | "email"
  | "experience_list"
  | "full_name"
  | "headline"
  | "job_description"
  | "job_location"
  | "missing_skills"
  | "recommended_achievements"
  | "role_title"
  | "selected_education"
  | "selected_experiences"
  | "skills"
  | "strong_skills"
  | "location";

export type SelectedExperienceTemplateField =
  | "achievements"
  | "company"
  | "description"
  | "end_date"
  | "period"
  | "skills"
  | "start_date"
  | "title";

export type SelectedEducationTemplateField =
  | "achievements"
  | "degree"
  | "end_date"
  | "field"
  | "institution"
  | "period"
  | "start_date";

export interface DocumentTemplateVariableAliases {
  fields: Partial<
    Record<Exclude<DocumentTemplateField, "selected_education" | "selected_experiences">, string>
  >;
  selectedEducation?: {
    fields: Partial<Record<SelectedEducationTemplateField, string>>;
    items?: Array<{
      fields: Partial<Record<SelectedEducationTemplateField, string>>;
    }>;
  };
  selectedExperiences?: {
    fields: Partial<Record<SelectedExperienceTemplateField, string>>;
    items?: Array<{
      fields: Partial<Record<SelectedExperienceTemplateField, string>>;
    }>;
  };
}

export interface DocumentTemplate {
  id: string;
  profileId: string;
  kind: DocumentTemplateKind;
  format: DocumentTemplateFormat;
  fileId: string;
  fileName: string;
  contentType: string;
  size: number;
  placeholders: string[];
  fieldMappings: Record<string, DocumentTemplateField>;
  variableAliases: DocumentTemplateVariableAliases;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDocumentTemplateInput {
  profileId: string;
  kind: DocumentTemplateKind;
  format: DocumentTemplateFormat;
  fileId: string;
  fileName: string;
  contentType: string;
  size: number;
  placeholders: string[];
  fieldMappings?: Record<string, DocumentTemplateField>;
  variableAliases?: DocumentTemplateVariableAliases;
  isDefault?: boolean;
}
