import type { ApiDocumentContent } from "./api/types";

export type ApplicationStatus = "Applied" | "Interviewing" | "Offer" | "Rejected";

export type Priority = "High" | "Mid" | "Low";

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

export interface KeywordMatch {
  keyword: string;
  match: boolean;
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
  priority: Priority;
  tags: string[];
  description?: string;
  requirements?: string[];
  timeline?: TimelineMilestone[];
  processingStatus?: string;
  processingStatusLabel?: string;
  processingFailureReason?: string;
  processingLog?: ProcessingLogItem[];
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
  interviewNotes?: string;
  contacts?: Contact[];
  generatedDocuments?: GeneratedApplicationDocument[];
  matchScore?: number;
  documentContent?: ApiDocumentContent;
  aiMatch?: {
    score: number;
    summary: string;
    keywords: KeywordMatch[];
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
