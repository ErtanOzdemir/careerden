export type ApiApplicationStatus = "applied" | "interview" | "offer" | "phone_screen" | "rejected";

export type ApiApplicationPriority = "high" | "low" | "medium";

export interface ApiJobApplicationTracking {
  applicationStatus: ApiApplicationStatus;
  companyName?: string;
  dateApplied?: string;
  jobUrl?: string;
  lastResponseAt?: string;
  metadata: Record<string, unknown>;
  nextFollowUpAt?: string;
  priority: ApiApplicationPriority;
  roleTitle?: string;
  roleType?: string;
  tags: string[];
}

export interface ApiGeneratedDocument {
  contentType: string;
  createdAt: string;
  fileId: string;
  fileName: string;
  format: "docx" | "pdf";
  id: string;
  jobApplicationId: string;
  kind: "cover_letter" | "cv";
}

export type ApiDocumentTemplateField =
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

export type ApiSelectedExperienceTemplateField =
  | "achievements"
  | "company"
  | "description"
  | "end_date"
  | "period"
  | "skills"
  | "start_date"
  | "title";

export type ApiSelectedEducationTemplateField =
  | "achievements"
  | "degree"
  | "end_date"
  | "field"
  | "institution"
  | "period"
  | "start_date";

export type ApiSelectedProjectTemplateField =
  | "achievements"
  | "description"
  | "name"
  | "skills"
  | "url";

export interface ApiDocumentTemplateVariableAliases {
  fields: Partial<
    Record<
      Exclude<
        ApiDocumentTemplateField,
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
    fields: Partial<Record<ApiSelectedEducationTemplateField, string>>;
    items?: Array<{
      fields: Partial<Record<ApiSelectedEducationTemplateField, string>>;
    }>;
  };
  selectedExperiences?: {
    fields: Partial<Record<ApiSelectedExperienceTemplateField, string>>;
    items?: Array<{
      fields: Partial<Record<ApiSelectedExperienceTemplateField, string>>;
    }>;
  };
  selectedProjects?: {
    fields: Partial<Record<ApiSelectedProjectTemplateField, string>>;
    items?: Array<{
      fields: Partial<Record<ApiSelectedProjectTemplateField, string>>;
    }>;
  };
}

export interface ApiDocumentTemplate {
  contentType: string;
  createdAt: string;
  fieldMappings: Record<string, ApiDocumentTemplateField>;
  fileId: string;
  fileName: string;
  format: "docx";
  id: string;
  isDefault: boolean;
  kind: "cv";
  placeholders: string[];
  profileId: string;
  size: number;
  updatedAt: string;
  variableAliases: ApiDocumentTemplateVariableAliases;
}

export interface ApiJobApplication {
  companyLogoUrl?: string;
  createdAt: string;
  documents?: ApiGeneratedDocument[];
  failureReason?: string;
  id: string;
  matchScore?: number;
  profileId: string;
  sourceUrl?: string;
  status: string;
  tracking: ApiJobApplicationTracking;
  updatedAt: string;
}

export interface ApiJobApplicationEvent {
  body?: string;
  createdAt: string;
  id: string;
  jobApplicationId: string;
  metadata: Record<string, unknown>;
  occurredAt: string;
  title: string;
  type: string;
}

export interface ApiJobApplicationContact {
  createdAt: string;
  email?: string;
  id: string;
  jobApplicationId: string;
  linkedInUrl?: string;
  name: string;
  notes?: string;
  phone?: string;
  role?: string;
  updatedAt: string;
}

export interface ApiJobApplicationInterview {
  createdAt: string;
  id: string;
  jobApplicationId: string;
  notes?: string;
  prepNotes?: string;
  scheduledAt: string;
  status: "cancelled" | "completed" | "upcoming";
  title: string;
  type?: string;
  updatedAt: string;
}

export interface ApiScrapeBundle {
  careerPage?: ApiScrapedCompany;
  companyLinkedIn?: ApiScrapedCompany;
  companyWebsite?: ApiScrapedCompany;
  job: {
    companyLinkedInUrl?: string;
    companyName: string;
    description: string;
    descriptionHtml?: string;
    location?: string;
    raw: unknown;
    requirements: string[];
    title: string;
  };
}

export interface ApiScrapedCompany {
  careerPageUrl?: string;
  description?: string;
  linkedInUrl?: string;
  name: string;
  raw: unknown;
  websiteUrl?: string;
}

export interface ApiMatchAnalysis {
  coverLetterGuidance?: string[];
  customizedSummary: string;
  experienceEnhancements?: {
    enhancedAchievements?: string[];
    enhancedDescription?: string;
    experienceIndex: number;
  }[];
  interviewTips: string[];
  matchScore: number;
  missingSkills: string[];
  recommendedAchievements: string[];
  strongSkills: string[];
  skillSuggestions?: string[];
  educationEnhancements?: {
    educationIndex: number;
    enhancedDescription?: string;
    enhancedAchievements?: string[];
  }[];
  projectEnhancements?: {
    projectIndex: number;
    enhancedDescription?: string;
    enhancedAchievements?: string[];
  }[];
  certificationSuggestions?: string[];
}

export type RichTextMark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "underline" }
  | { type: "link"; href: string };

export interface RichTextNode {
  type: "text";
  text: string;
  marks?: RichTextMark[];
}

export type RichBlock =
  | {
      type: "paragraph";
      alignment?: "left" | "center" | "right" | "justify";
      children: RichTextNode[];
    }
  | {
      type: "heading";
      level: 1 | 2 | 3;
      alignment?: "left" | "center" | "right" | "justify";
      children: RichTextNode[];
    }
  | {
      type: "bulletList" | "orderedList";
      items: Array<{ blocks: RichBlock[] }>;
    }
  | {
      type: "table";
      rows: Array<{ cells: Array<{ blocks: RichBlock[] }> }>;
    };

export interface RichDocument {
  version: 1;
  blocks: RichBlock[];
}

export interface ApiDocumentContentSelections {
  customizedSummary?: "ai" | "original";
  skills?: "ai" | "original";
  certifications?: "ai" | "original";
  experience: Record<
    string,
    {
      description?: "ai" | "original";
      achievements: Record<string, "ai" | "original">;
    }
  >;
  education: Record<
    string,
    {
      description?: "ai" | "original";
      achievements: Record<string, "ai" | "original">;
    }
  >;
  projects: Record<
    string,
    {
      description?: "ai" | "original";
      achievements: Record<string, "ai" | "original">;
    }
  >;
}

export interface ApiDocumentContent {
  customizedSummary: RichDocument;
  experienceEnhancements: Array<{
    experienceIndex: number;
    description?: RichDocument;
    achievements: RichDocument[];
  }>;
  skillSuggestions: string[];
  educationEnhancements: Array<{
    educationIndex: number;
    description?: RichDocument;
    achievements: RichDocument[];
  }>;
  projectEnhancements: Array<{
    projectIndex: number;
    description?: RichDocument;
    achievements: RichDocument[];
  }>;
  certificationSuggestions: string[];
  selections: ApiDocumentContentSelections;
}

export interface ApiJobApplicationDetail extends ApiJobApplication {
  contacts: ApiJobApplicationContact[];
  events: ApiJobApplicationEvent[];
  interviews: ApiJobApplicationInterview[];
  matchAnalysis: ApiMatchAnalysis | null;
  documentContent: ApiDocumentContent | null;
  scrapeBundle: ApiScrapeBundle | null;
}

export interface ApiJobApplicationAnalytics {
  applicationsOverTime: Record<string, number>;
  averageTimeToResponseDays: number | null;
  byStatus: Partial<Record<ApiApplicationStatus, number>>;
  interviewConversionRate: number;
  offers: number;
  rejections: number;
  responseRate: number;
  total: number;
}

export interface ApiProfileExperience {
  achievements: string[];
  company: string;
  description?: string;
  endDate?: string;
  skills?: string[];
  startDate?: string;
  title: string;
}

export interface ApiProfileEducation {
  achievements: string[];
  degree?: string;
  endDate?: string;
  field?: string;
  institution: string;
  startDate?: string;
}

export interface ApiProfileProject {
  achievements: string[];
  description?: string;
  name: string;
  skills: string[];
  url?: string;
}

export interface ApiProfile {
  certifications: string[];
  createdAt: string;
  education: ApiProfileEducation[];
  email: string;
  experience: ApiProfileExperience[];
  fullName: string;
  headline?: string;
  id: string;
  links: string[];
  location?: string;
  profession?: string;
  projects: ApiProfileProject[];
  skills: string[];
  summary?: string;
  updatedAt: string;
}

export type ApiUpdateProfilePayload = Partial<
  Pick<
    ApiProfile,
    | "certifications"
    | "education"
    | "email"
    | "experience"
    | "fullName"
    | "headline"
    | "links"
    | "location"
    | "profession"
    | "projects"
    | "skills"
    | "summary"
  >
>;

export type ApiLinkedInSessionStatus = "connected" | "expired" | "login_in_progress" | "missing";

export interface ApiLinkedInSessionStatusResult {
  message?: string;
  status: ApiLinkedInSessionStatus;
  updatedAt?: string;
}
