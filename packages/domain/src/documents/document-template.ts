export type DocumentTemplateKind = "cv";
export type DocumentTemplateFormat = "docx";

export type DocumentTemplateField =
  | "certifications"
  | "company_name"
  | "customized_summary"
  | "education_list"
  | "email"
  | "experience_list"
  | "full_name"
  | "headline"
  | "job_description"
  | "job_location"
  | "links"
  | "location"
  | "missing_skills"
  | "profession"
  | "projects"
  | "recommended_achievements"
  | "role_title"
  | "selected_education"
  | "selected_experiences"
  | "selected_projects"
  | "skills"
  | "strong_skills"
  | "summary";

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

export type SelectedProjectTemplateField =
  | "achievements"
  | "description"
  | "name"
  | "skills"
  | "url";

export interface DocumentTemplateVariableAliases {
  fields: Partial<
    Record<
      Exclude<
        DocumentTemplateField,
        "selected_education" | "selected_experiences" | "selected_projects"
      >,
      string
    >
  >;
  certificationItems?: Array<{
    variableName?: string;
  }>;
  linkItems?: Array<{
    variableName?: string;
  }>;
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
  selectedProjects?: {
    fields: Partial<Record<SelectedProjectTemplateField, string>>;
    items?: Array<{
      fields: Partial<Record<SelectedProjectTemplateField, string>>;
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
