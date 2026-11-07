import type { ScrapingFailureCategory } from "@careerden/contracts";
import type {
  ApiApplicationPackPreferences,
  ApiApplicationStatus,
  ApiDocumentContent,
  ApiGapQuestionField,
  ApiProfileReadiness,
} from "./api/types";

export type ApplicationStatus =
  | "Saved"
  | "Applied"
  | "Interviewing"
  | "Offer"
  | "Declined"
  | "Rescinded"
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

export type RequirementMatchStatus = "matched" | "partial" | "missing";

export interface RequirementMatch {
  requirement: string;
  status: RequirementMatchStatus;
  evidence: string[];
  /** Absent for analyses made before priorities existed; treat as "must". */
  priority?: "must" | "nice";
}

/** A question about experience the job asks for that the profile does not show yet. */
export interface GapQuestion {
  question: string;
  requirement?: string;
  field: ApiGapQuestionField;
}

/** A prose CV tip, optionally linked to the job requirement it addresses and the profile fact it uses. */
export interface CvTip {
  text: string;
  requirement?: string;
  evidence?: string;
}

/** Suggests one skill or certification to add, named exactly as it should appear on the CV. */
export interface CvListTip {
  item: string;
  text: string;
  requirement?: string;
}

export interface IndexedFieldTips {
  index: number;
  tips: CvTip[];
}

export interface GeneratedApplicationDocument {
  createdAt: string;
  format: "docx" | "pdf";
  id: string;
  kind: "cover_letter" | "cv";
  name: string;
}

export interface JobApplication {
  analysisAttemptId?: string;
  archivedAt?: string;
  analysisSkipReason?: "insufficient_credits" | "ai_provider_not_configured";
  applicationPackPreferences?: ApiApplicationPackPreferences;
  id: string;
  profileId?: string;
  updatedAt?: string;
  company: string;
  companyDescription?: string;
  companyWebsiteUrl?: string;
  domain: string;
  logo?: string;
  role: string;
  location: string;
  dateApplied: string;
  dateLabel: string;
  status: ApplicationStatus;
  // The latest status change, while it can still be undone.
  lastStatusChange?: { id: string; from: ApiApplicationStatus; to: ApiApplicationStatus };
  interestLevel?: InterestLevel;
  tags: string[];
  description?: string;
  descriptionHtml?: string;
  requirements?: string[];
  timeline?: TimelineMilestone[];
  processingStatus?: string;
  processingStatusLabel?: string;
  processingFailureReason?: string;
  // Why the latest LinkedIn import failed, when that is what failed.
  processingFailureCategory?: ScrapingFailureCategory;
  processingLog?: ProcessingLogItem[];
  profileReadiness?: ApiProfileReadiness;
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
    requirements?: RequirementMatch[];
    recommendation: string;
    summaryTips: CvTip[];
    experienceTips: IndexedFieldTips[];
    educationTips: IndexedFieldTips[];
    projectTips: IndexedFieldTips[];
    skillsTips: CvListTip[];
    certificationsTips: CvListTip[];
    gapQuestions: GapQuestion[];
    /** Job skills (matched and missing) used for live keyword coverage of the draft CV. */
    keywords: string[];
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
  jobApplicationId: string;
  month: string;
  day: number;
  time: string;
  company: string;
  role: string;
  meetType: string;
  meetLabel: string;
}

export interface DashboardSankeyCompany {
  id: string;
  name?: string;
  logoUrl?: string;
}

export interface DashboardSankeyNode {
  id: string;
  // Application status the node stands for; outcome nodes repeat it once per stage.
  status: string;
  label: string;
  // Applications that reached this stage.
  count: number;
}

export interface DashboardSankeyLink {
  source: string;
  target: string;
  value: number;
  // Companies shown on this ribbon, most recently updated first.
  companies?: DashboardSankeyCompany[];
}

export interface DashboardSankeyData {
  nodes: DashboardSankeyNode[];
  links: DashboardSankeyLink[];
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
  sankey: DashboardSankeyData;
  upcomingInterviews: UpcomingInterview[];
}
