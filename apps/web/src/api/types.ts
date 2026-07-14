export type ApiApplicationStatus =
  | "saved"
  | "applied"
  | "interview"
  | "offer"
  | "phone_screen"
  | "rejected"
  | "ghosted";

export type ApiApplicationPriority = "high" | "low" | "medium";

export interface ApiJobApplicationTracking {
  applicationStatus: ApiApplicationStatus;
  companyName?: string;
  dateApplied?: string;
  jobUrl?: string;
  lastResponseAt?: string;
  metadata: Record<string, unknown>;
  priority?: ApiApplicationPriority;
  roleTitle?: string;
  roleType?: string;
  salaryCurrency?: string;
  salaryMaxAmount?: number;
  salaryMinAmount?: number;
  salaryPeriod?: "hourly" | "monthly" | "yearly";
  salaryType?: "gross" | "net";
  workStyle?: "hybrid" | "on_site" | "remote";
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

export type ApiApplicationPackTone = "professional" | "concise" | "creative";

export interface ApiApplicationPackPreferences {
  language: string;
  tone: ApiApplicationPackTone;
  cvTemplateId?: string;
  coverLetterTemplateId?: string;
}

export interface ApiProfileReadiness {
  state: "ready" | "warning" | "blocked";
  warnings: Array<"evidence" | "positioning" | "skills">;
}

export type ApiDocumentTemplateField =
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

export type ApiSelectedExperienceTemplateField =
  | "company"
  | "description"
  | "end_date"
  | "period"
  | "start_date"
  | "title";

export type ApiSelectedEducationTemplateField =
  | "degree"
  | "description"
  | "end_date"
  | "field"
  | "institution"
  | "period"
  | "start_date";

export type ApiSelectedProjectTemplateField = "description" | "name" | "url";

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
  kind: "cover_letter" | "cv";
  placeholders: string[];
  profileId: string;
  size: number;
  updatedAt: string;
  variableAliases: ApiDocumentTemplateVariableAliases;
}

export interface ApiJobApplication {
  applicationPackPreferences: ApiApplicationPackPreferences;
  companyLogoUrl?: string;
  createdAt: string;
  documents?: ApiGeneratedDocument[];
  documentGenerationAttemptId?: string;
  failureReason?: string;
  id: string;
  matchScore?: number;
  profileId: string;
  sourceUrl?: string;
  status: string;
  tracking: ApiJobApplicationTracking;
  updatedAt: string;
}

export interface ApiJobApplicationsPage {
  items: ApiJobApplication[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
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

export interface ApiJobApplicationFollowUp {
  createdAt: string;
  description?: string;
  id: string;
  jobApplicationId: string;
  profileId: string;
  reminderJobId?: string;
  reminderScheduledFor?: string;
  reminderSentAt?: string;
  scheduledAt: string;
  title: string;
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
  coverLetterContent?: string;
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
  missingSkillResources?: {
    reason: string;
    skill: string;
    title: string;
    type: "article" | "documentation" | "other" | "tutorial" | "video";
    url: string;
  }[];
  recommendedAchievements: string[];
  requirementEvaluations?: {
    evidence: string[];
    requirement: string;
    status: "matched" | "missing" | "partial";
  }[];
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
  coverLetterContent?: RichDocument;
  customizedSummary: RichDocument;
  formatVersion?: 2;
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
  followUps: ApiJobApplicationFollowUp[];
  matchAnalysis: ApiMatchAnalysis | null;
  profileReadiness: ApiProfileReadiness;
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
  company: string;
  description?: string;
  descriptionRichText?: RichDocument;
  endDate?: string;
  startDate?: string;
  title: string;
}

export interface ApiProfileEducation {
  degree?: string;
  endDate?: string;
  field?: string;
  institution: string;
  startDate?: string;
}

export interface ApiProfileProject {
  achievements: string[];
  description?: string;
  descriptionRichText?: RichDocument;
  name: string;
  skills: string[];
  url?: string;
}

export interface ApiProfile {
  autoGenerateDocuments: boolean;
  autoRunMatchAnalysis: boolean;
  followUpRemindersEnabled: boolean;
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
  summaryRichText?: RichDocument;
  updatedAt: string;
}

export type ApiUpdateProfilePayload = Partial<
  Pick<
    ApiProfile,
    | "autoGenerateDocuments"
    | "autoRunMatchAnalysis"
    | "followUpRemindersEnabled"
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
    | "summaryRichText"
  >
>;

export interface ApiNotification {
  body?: string;
  createdAt: string;
  id: string;
  jobApplicationId?: string;
  profileId: string;
  readAt?: string;
  title: string;
  type: "follow_up_reminder";
}

export type ApiLinkedInSessionStatus = "connected" | "expired" | "login_in_progress" | "missing";

export interface ApiLinkedInSessionStatusResult {
  message?: string;
  status: ApiLinkedInSessionStatus;
  updatedAt?: string;
}
