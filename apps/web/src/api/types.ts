import type { AiProviderFailureDto, ProfileSkillGroup, RichDocument } from "@careerden/contracts";

export type ApiApplicationStatus =
  | "saved"
  | "applied"
  | "interview"
  | "offer"
  | "phone_screen"
  | "declined"
  | "rescinded"
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

export interface ApiJobApplication {
  // Present when processing failed because of the AI provider.
  aiFailure?: AiProviderFailureDto;
  analysisAttemptId?: string;
  // Present on an update that changed the status; undoes it through undoStatusChange.
  statusChangeId?: string;
  archivedAt?: string;
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
  companyManual?: ApiScrapedCompany;
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

/** Analyses stored before tips were structured carry plain strings; newer ones carry objects. */
export type ApiCvTip = string | { text: string; requirement?: string; evidence?: string };
export type ApiCvListTip = string | { item: string; text: string; requirement?: string };

export type ApiGapQuestionField =
  | { type: "summary" }
  | { type: "education" | "experience" | "project"; index: number };

export interface ApiGapQuestion {
  field: ApiGapQuestionField;
  question: string;
  requirement?: string;
}

export interface ApiMatchAnalysis {
  coverLetterContent?: string;
  coverLetterGuidance?: string[];
  summaryTips: ApiCvTip[];
  experienceTips?: {
    tips: ApiCvTip[];
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
  requirementEvaluations?: {
    evidence: string[];
    priority?: "must" | "nice";
    requirement: string;
    status: "matched" | "missing" | "partial";
  }[];
  gapQuestions?: ApiGapQuestion[];
  strongSkills: string[];
  skillsTips?: ApiCvListTip[];
  educationTips?: {
    educationIndex: number;
    tips: ApiCvTip[];
  }[];
  projectTips?: {
    projectIndex: number;
    tips: ApiCvTip[];
  }[];
  certificationsTips?: ApiCvListTip[];
}

/** Mirrors `DocumentFieldRef` in `@careerden/contracts` — identifies one tailorable CV field. */
export type ApiDocumentFieldRef =
  | { type: "summary" }
  | { type: "experience"; index: number }
  | { type: "education"; index: number }
  | { type: "project"; index: number }
  | { type: "skills" }
  | { type: "certifications" };

/** The subset of `ApiDocumentFieldRef` valid for `POST /:id/document-content/apply-tip`. */
export type ApiApplyFieldTipFieldRef =
  | { type: "summary" }
  | { type: "experience"; index: number }
  | { type: "education"; index: number }
  | { type: "project"; index: number };

// Re-exported from the shared contract so the many `from "../api/types.js"` imports keep working
// while there is only one definition of the rich-text shape in the repo.
export type { RichBlock, RichDocument, RichTextMark, RichTextNode } from "@careerden/contracts";

export interface ApiDocumentContent {
  coverLetterContent?: RichDocument;
  customizedSummary: RichDocument;
  formatVersion?: 2;
  experienceEnhancements: Array<{
    experienceIndex: number;
    description?: RichDocument;
  }>;
  skillSuggestions: string[];
  educationEnhancements: Array<{
    educationIndex: number;
    description?: RichDocument;
  }>;
  projectEnhancements: Array<{
    projectIndex: number;
    description?: RichDocument;
  }>;
  certificationSuggestions: string[];
  /** Tips and gap questions already accepted for this application. */
  appliedTips?: string[];
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
  pipeline?: Array<{
    source: "applications" | ApiApplicationStatus;
    target: ApiApplicationStatus;
    count: number;
    companies: Array<{ jobApplicationId: string; companyName?: string; companyLogoUrl?: string }>;
  }>;
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
  description?: string;
  descriptionRichText?: RichDocument;
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

/** A skill category; an empty name holds uncategorized skills. */
export type ApiProfileSkillGroup = ProfileSkillGroup;

export interface ApiProfile {
  autoGenerateDocuments: boolean;
  autoRunMatchAnalysis: boolean;
  followUpRemindersEnabled: boolean;
  certifications: string[];
  createdAt: string;
  defaultCoverLetterTemplateId?: string;
  defaultCvTemplateId?: string;
  education: ApiProfileEducation[];
  email: string;
  experience: ApiProfileExperience[];
  fullName: string;
  headline?: string;
  id: string;
  links: string[];
  location?: string;
  onboardingChecklistDismissedAt?: string;
  onboardingCompletedAt?: string;
  profession?: string;
  projects: ApiProfileProject[];
  skillGroups: ApiProfileSkillGroup[];
  summary?: string;
  summaryRichText?: RichDocument;
  updatedAt: string;
}

/** Profile details read from a CV; nothing is saved until the reviewed draft is applied. */
export type ApiProfileImportDraft = Partial<
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
    | "skillGroups"
    | "summary"
  >
>;

export interface ApiUpdateOnboardingPayload {
  checklistDismissed?: boolean;
  completed?: boolean;
}

export type ApiUpdateProfilePayload = Partial<
  Pick<
    ApiProfile,
    | "autoGenerateDocuments"
    | "autoRunMatchAnalysis"
    | "followUpRemindersEnabled"
    | "certifications"
    | "defaultCoverLetterTemplateId"
    | "defaultCvTemplateId"
    | "education"
    | "email"
    | "experience"
    | "fullName"
    | "headline"
    | "links"
    | "location"
    | "profession"
    | "projects"
    | "skillGroups"
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
