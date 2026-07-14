export type DocumentTemplateKind = "cover_letter" | "cv";
export type DocumentTemplateFormat = "docx";

export type DocumentTemplateField =
  | "certifications"
  | "company_name"
  | "cover_letter_content"
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
  | "company"
  | "description"
  | "end_date"
  | "period"
  | "start_date"
  | "title";

export type SelectedEducationTemplateField =
  | "degree"
  | "description"
  | "end_date"
  | "field"
  | "institution"
  | "period"
  | "start_date";

export type SelectedProjectTemplateField = "description" | "name" | "url";

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
