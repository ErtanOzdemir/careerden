import type { ApiDocumentContent } from "./api/types";

export type ApplicationStatus =
  | "Saved"
  | "Applied"
  | "Interviewing"
  | "Offer"
  | "Rejected"
  | "Ghosted";

export type InterestLevel = "high" | "low" | "medium";

export type MilestoneStatus = "cancelled" | "completed" | "upcoming";

export interface TimelineMilestone {
  id: string;
  title: string;
  description: string;
  date: string;
  status: MilestoneStatus;
  type?: string;
}

export type ProcessingLogStatus = "completed" | "failed";

export interface ProcessingLogItem {
  id: string;
  title: string;
  description: string;
  date: string;
  status: ProcessingLogStatus;
}

export interface Contact {
  email?: string;
  initials: string;
  name: string;
  notes?: string;
  phone?: string;
  role: string;
  color?: string;
}

export interface FollowUp {
  id: string;
  title: string;
  description?: string;
  scheduledAt: string;
  reminderSentAt?: string;
  createdAt: string;
}

export interface KeywordMatch {
  keyword: string;
  match: boolean;
}

export type RequirementMatchStatus = "matched" | "partial" | "missing";

export interface RequirementMatch {
  requirement: string;
  status: RequirementMatchStatus;
  evidence: string[];
}

export interface BulletOptimization {
  original: string;
  enhanced: string;
}

export interface ExperienceOptimizationItem {
  actual: string;
  enhanced?: string;
  kind: "achievement" | "description";
}

export interface GeneratedApplicationDocument {
  createdAt: string;
  format: "docx" | "pdf";
  id: string;
  kind: "cover_letter" | "cv";
  name: string;
}

export interface JobApplication {
  id: string;
  profileId?: string;
  updatedAt?: string;
  company: string;
  domain: string;
  logo?: string;
  role: string;
  location: string;
  dateApplied: string;
  dateLabel: string;
  status: ApplicationStatus;
  interestLevel?: InterestLevel;
  tags: string[];
  description?: string;
  descriptionHtml?: string;
  requirements?: string[];
  timeline?: TimelineMilestone[];
  processingStatus?: string;
  processingStatusLabel?: string;
  processingFailureReason?: string;
  processingLog?: ProcessingLogItem[];
  sourceUrl?: string;
  salaryCurrency?: string;
  salaryMaxAmount?: number;
  salaryMinAmount?: number;
  salaryPeriod?: "hourly" | "monthly" | "yearly";
  salaryType?: "gross" | "net";
  workStyle?: "hybrid" | "on_site" | "remote";
  metadata?: Record<string, unknown>;
  contacts?: Contact[];
  followUps?: FollowUp[];
  generatedDocuments?: GeneratedApplicationDocument[];
  matchScore?: number;
  documentContent?: ApiDocumentContent;
  aiMatch?: {
    score: number;
    summary: string;
    keywords: KeywordMatch[];
    requirements?: RequirementMatch[];
    recommendation: string;
    currentSummary: string;
    enhancedSummary: string;
    bulletOptimizations: BulletOptimization[];
    experienceOptimizations?: {
      title: string;
      company: string;
      items: ExperienceOptimizationItem[];
    }[];
    yourSkills: string[];
    suggestedSkills: string[];
    missingSkillResources?: {
      reason: string;
      skill: string;
      title: string;
      type: "article" | "documentation" | "other" | "tutorial" | "video";
      url: string;
    }[];
    educationOptimizations?: {
      institution: string;
      degree: string;
      items: ExperienceOptimizationItem[];
    }[];
    projectOptimizations?: {
      name: string;
      items: ExperienceOptimizationItem[];
    }[];
  };
}

export interface Profile {
  id: string;
  fullName: string;
  title: string;
  headline: string;
  summary: string;
  location: string;
  email: string;
  portfolio: string;
  avatar?: string;
  experiences: Experience[];
  skills: SkillCategory[];
  education: Education[];
  documents: Document[];
  certifications?: string[];
}

export interface Experience {
  id: string;
  title: string;
  company: string;
  period: string;
  achievements: string[];
  icon: string;
}

export interface SkillCategory {
  name: string;
  icon: string;
  color?: string;
  skills: string[];
}

export interface Education {
  id: string;
  degree: string;
  institution: string;
  period: string;
  icon: string;
}

export interface Document {
  id: string;
  name: string;
  size: string;
  uploaded: string;
  isMaster?: boolean;
}

export interface KpiTrend {
  value: number;
  label: string;
  positive?: boolean;
}

export interface UpcomingInterview {
  month: string;
  day: number;
  time: string;
  company: string;
  role: string;
  meetType: string;
  meetLabel: string;
}

export interface DashboardStats {
  totalApplications: number;
  activeInterviews: number;
  offers: number;
  rejectionRate: number;
  weeklyTrend: number[];
  applicationsByStatus: { status: string; count: number }[];
  kpis: {
    totalApplications: KpiTrend;
    activeInterviews: KpiTrend;
    offers: KpiTrend;
    rejectionRate: KpiTrend;
  };
  statusDistributionTotal: number;
  upcomingInterviews: UpcomingInterview[];
}
