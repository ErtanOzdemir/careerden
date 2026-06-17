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
  contentType: "application/pdf";
  createdAt: string;
  fileId: string;
  fileName: string;
  id: string;
  jobApplicationId: string;
  kind: "cover_letter" | "cv";
}

export interface ApiJobApplication {
  createdAt: string;
  documents?: ApiGeneratedDocument[];
  failureReason?: string;
  id: string;
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
  interviewTips: string[];
  matchScore: number;
  missingSkills: string[];
  recommendedAchievements: string[];
  strongSkills: string[];
}

export interface ApiJobApplicationDetail extends ApiJobApplication {
  contacts: ApiJobApplicationContact[];
  events: ApiJobApplicationEvent[];
  interviews: ApiJobApplicationInterview[];
  matchAnalysis: ApiMatchAnalysis | null;
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
  location?: string;
  projects: ApiProfileProject[];
  skills: string[];
  summary?: string;
  updatedAt: string;
}

export type ApiLinkedInSessionStatus = "connected" | "expired" | "login_in_progress" | "missing";

export interface ApiLinkedInSessionStatusResult {
  message?: string;
  status: ApiLinkedInSessionStatus;
  updatedAt?: string;
}
