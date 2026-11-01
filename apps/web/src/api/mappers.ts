import type {
  ApiApplicationStatus,
  ApiCvListTip,
  ApiCvTip,
  ApiJobApplication,
  ApiJobApplicationAnalytics,
  ApiJobApplicationDetail,
  ApiJobApplicationEvent,
  ApiJobApplicationFollowUp,
  ApiMatchAnalysis,
  ApiProfile,
} from "./types";
import type {
  ApplicationStatus,
  CvListTip,
  CvTip,
  DashboardSankeyNode,
  DashboardStats,
  FollowUp,
  JobApplication,
  InterestLevel,
  ProcessingLogItem,
  Profile,
  TimelineMilestone,
  UpcomingInterview,
} from "../types";
import { richDocumentFromText } from "@careerden/contracts";
import type { RichDocument } from "./types.js";

export function mapApiStatusToUi(status: ApiApplicationStatus): ApplicationStatus {
  switch (status) {
    case "saved":
      return "Saved";
    case "offer":
      return "Offer";
    case "declined":
      return "Declined";
    case "rescinded":
      return "Rescinded";
    case "rejected":
      return "Rejected";
    case "ghosted":
      return "Ghosted";
    case "interview":
    case "phone_screen":
      return "Interviewing";
    case "applied":
      return "Applied";
  }
}

export function mapUiStatusToApi(status: ApplicationStatus): ApiApplicationStatus {
  switch (status) {
    case "Saved":
      return "saved";
    case "Offer":
      return "offer";
    case "Declined":
      return "declined";
    case "Rescinded":
      return "rescinded";
    case "Rejected":
      return "rejected";
    case "Ghosted":
      return "ghosted";
    case "Interviewing":
      return "interview";
    case "Applied":
      return "applied";
  }
}

export function mapApiJobApplicationToUi(
  application: ApiJobApplication | ApiJobApplicationDetail,
  profile?: ApiProfile,
): JobApplication {
  const detail = isJobApplicationDetail(application) ? application : undefined;
  const scrapeJob = detail?.scrapeBundle?.job;
  const company = application.tracking.companyName ?? scrapeJob?.companyName ?? "Unknown company";
  const role = application.tracking.roleTitle ?? scrapeJob?.title ?? "Untitled role";
  const dateSource = application.tracking.dateApplied ?? application.createdAt;
  const scrapedCompanyWebsiteUrl =
    detail?.scrapeBundle?.companyManual?.websiteUrl ??
    detail?.scrapeBundle?.companyLinkedIn?.websiteUrl ??
    detail?.scrapeBundle?.companyWebsite?.websiteUrl;
  const companyWebsiteUrl = scrapedCompanyWebsiteUrl?.trim();
  const companyDescription = [
    detail?.scrapeBundle?.companyManual?.description,
    detail?.scrapeBundle?.companyLinkedIn?.description,
    detail?.scrapeBundle?.companyWebsite?.description,
    detail?.scrapeBundle?.careerPage?.description,
  ]
    .map((description) => description?.trim())
    .find((description): description is string => Boolean(description));

  return {
    analysisAttemptId: application.analysisAttemptId,
    archivedAt: application.archivedAt,
    analysisSkipReason: detail ? getAnalysisSkipReason(detail.events) : undefined,
    applicationPackPreferences: application.applicationPackPreferences,
    id: application.id,
    profileId: application.profileId,
    updatedAt: application.updatedAt,
    company,
    companyDescription,
    companyWebsiteUrl:
      companyWebsiteUrl && isHttpUrl(companyWebsiteUrl) ? companyWebsiteUrl : undefined,
    logo: application.companyLogoUrl,
    domain: getDomain(application.tracking.jobUrl ?? application.sourceUrl),
    role,
    location: scrapeJob?.location ?? application.tracking.roleType ?? "Location not set",
    dateApplied: formatDate(dateSource),
    dateLabel: formatRelativeDate(dateSource),
    status: mapApiStatusToUi(application.tracking.applicationStatus),
    lastStatusChange: detail
      ? getUndoableStatusChange(detail.events, application.tracking.applicationStatus)
      : undefined,
    interestLevel: application.tracking.priority as InterestLevel | undefined,
    tags: application.tracking.tags,
    description: scrapeJob?.description,
    descriptionHtml: scrapeJob?.descriptionHtml,
    requirements: scrapeJob?.requirements,
    timeline: mapTimeline(application),
    processingStatus: application.status,
    processingStatusLabel: formatProcessingStatus(application.status, application.failureReason),
    processingFailureReason: application.failureReason,
    processingLog: detail ? mapProcessingLog(detail.events) : undefined,
    profileReadiness: detail?.profileReadiness,
    sourceUrl: application.sourceUrl,
    salaryCurrency: application.tracking.salaryCurrency,
    salaryMaxAmount: application.tracking.salaryMaxAmount,
    salaryMinAmount: application.tracking.salaryMinAmount,
    salaryPeriod: application.tracking.salaryPeriod,
    salaryType: application.tracking.salaryType,
    workStyle: application.tracking.workStyle,
    followUps: detail?.followUps.map(mapFollowUp),
    matchScore: application.matchScore ?? detail?.matchAnalysis?.matchScore,
    metadata: application.tracking.metadata,
    contacts: detail?.contacts.map((contact) => ({
      email: contact.email,
      initials: getInitials(contact.name),
      name: contact.name,
      phone: contact.phone,
      role: contact.role ?? "Contact",
    })),
    generatedDocuments: application.documents?.map((document) => ({
      id: document.id,
      kind: document.kind,
      format: document.format,
      name: document.fileName,
      createdAt: formatDate(document.createdAt),
    })),
    aiMatch: detail?.matchAnalysis ? mapMatchAnalysis(detail.matchAnalysis) : undefined,
    documentContent:
      detail?.documentContent ??
      (detail?.matchAnalysis
        ? mapInitialDocumentContent(detail.matchAnalysis, profile)
        : undefined),
  };
}

function getAnalysisSkipReason(
  events: ApiJobApplicationEvent[],
): JobApplication["analysisSkipReason"] {
  for (const reason of ["insufficient_credits", "ai_provider_not_configured"] as const) {
    if (events.some((event) => event.metadata.reason === reason)) return reason;
  }
  return undefined;
}

/**
 * Seeds the editable document from the profile's own text — not from AI output. This mirrors
 * `documentContentFromProfile` in `@careerden/domain` (the server does the same thing right after
 * analysis completes); it only exists here as a client-side fallback for the brief window before
 * the server-persisted `documentContent` has loaded.
 */
function mapInitialDocumentContent(match: ApiMatchAnalysis, profile?: ApiProfile) {
  const toRichDocument = (text?: string, richText?: RichDocument): RichDocument | undefined =>
    richText ?? (text ? richDocumentFromText(text) : undefined);

  return {
    coverLetterContent: richDocumentFromText(match.coverLetterContent ?? ""),
    customizedSummary:
      toRichDocument(profile?.summary, profile?.summaryRichText) ?? richDocumentFromText(""),
    formatVersion: 2 as const,
    experienceEnhancements: (profile?.experience ?? []).map((experience, index) => ({
      experienceIndex: index,
      description: toRichDocument(experience.description, experience.descriptionRichText),
    })),
    skillSuggestions: profile?.skills ?? [],
    educationEnhancements: (profile?.education ?? []).map((education, index) => ({
      educationIndex: index,
      description: toRichDocument(education.description, education.descriptionRichText),
    })),
    projectEnhancements: (profile?.projects ?? []).map((project, index) => ({
      projectIndex: index,
      description: toRichDocument(project.description, project.descriptionRichText),
    })),
    certificationSuggestions: profile?.certifications ?? [],
  };
}

export function mapApiProfileToUi(profile: ApiProfile): Profile {
  return {
    id: profile.id,
    fullName: profile.fullName,
    title: getProfileTitle(profile),
    headline: profile.headline ?? profile.summary ?? "No headline added yet.",
    summary: profile.summary ?? "",
    location: profile.location ?? "Location not set",
    email: profile.email,
    portfolio:
      profile.links?.[0] ?? profile.projects.find((project) => project.url)?.url ?? "Links not set",
    experiences: profile.experience.map((experience, index) => ({
      id: `${profile.id}-experience-${index}`,
      title: experience.title,
      company: experience.company,
      period: formatPeriod(experience.startDate, experience.endDate),
      achievements: [experience.description ?? "No description added yet."],
      icon: "work",
    })),
    skills: [
      {
        name: "Skills",
        icon: "design_services",
        skills: profile.skills,
      },
    ],
    education: profile.education.map((education, index) => ({
      id: `${profile.id}-education-${index}`,
      degree: [education.degree, education.field].filter(Boolean).join(", ") || "Education",
      institution: education.institution,
      period: formatPeriod(education.startDate, education.endDate),
      icon: "school",
    })),
    documents: [],
  };
}

export function mapApiDashboardStats(
  analytics: ApiJobApplicationAnalytics,
  details: ApiJobApplicationDetail[],
): DashboardStats {
  const activeInterviews =
    (analytics.byStatus.phone_screen ?? 0) + (analytics.byStatus.interview ?? 0);
  const rejectionRate =
    analytics.total === 0
      ? 0
      : Math.round(((analytics.byStatus.rejected ?? 0) / analytics.total) * 100);
  const weeklyTrend = Object.entries(analytics.applicationsOverTime)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, count]) => count)
    .slice(-8);
  const paddedWeeklyTrend = weeklyTrend.length > 0 ? weeklyTrend : [0];

  return {
    totalApplications: analytics.total,
    activeInterviews,
    offers: analytics.offers,
    rejectionRate,
    weeklyTrend: paddedWeeklyTrend,
    applicationsByStatus: [
      { status: "Saved", count: analytics.byStatus.saved ?? 0 },
      { status: "Applied", count: analytics.byStatus.applied ?? 0 },
      {
        status: "Interviewing",
        count: activeInterviews,
      },
      { status: "Offer", count: analytics.byStatus.offer ?? 0 },
      { status: "Offer declined", count: analytics.byStatus.declined ?? 0 },
      { status: "Offer rescinded", count: analytics.byStatus.rescinded ?? 0 },
      { status: "Rejected", count: analytics.byStatus.rejected ?? 0 },
      { status: "Ghosted", count: analytics.byStatus.ghosted ?? 0 },
    ],
    kpis: {
      totalApplications: {
        value: analytics.total,
        label: `${analytics.total} total`,
        positive: true,
      },
      activeInterviews: {
        value: activeInterviews,
        label: `${Math.round(analytics.interviewConversionRate * 100)}% conversion`,
        positive: true,
      },
      offers: {
        value: analytics.offers,
        label: `${analytics.offers} offers`,
        positive: true,
      },
      rejectionRate: {
        value: rejectionRate,
        label: `${analytics.rejections} rejected`,
        positive: false,
      },
    },
    statusDistributionTotal: analytics.total,
    sankey: mapDashboardSankey(analytics),
    upcomingInterviews: mapUpcomingInterviews(details),
  };
}

const dashboardSankeyLabels: Record<"applications" | ApiApplicationStatus, string> = {
  applications: "Applications",
  saved: "Saved",
  applied: "Applied",
  phone_screen: "Phone screen",
  interview: "Interview",
  offer: "Offer",
  declined: "Declined",
  rescinded: "Rescinded",
  rejected: "Rejected",
  ghosted: "Ghosted",
};

const dashboardSankeyOutcomes = new Set<string>(["declined", "rescinded", "rejected", "ghosted"]);

// Stages share one node each. Outcomes get a node per stage they end, placed right after that
// stage, so ribbons into "Rejected" never cross the rest of the pipeline.
function mapDashboardSankey(analytics: ApiJobApplicationAnalytics): DashboardStats["sankey"] {
  const flows = analytics.pipeline ?? [];
  if (analytics.total === 0 || flows.length === 0) {
    return { nodes: [], links: [] };
  }

  const order = Object.keys(dashboardSankeyLabels);
  const nodeId = (status: string, source: string) =>
    dashboardSankeyOutcomes.has(status) ? `${source}:${status}` : status;
  const nodes = new Map<string, DashboardSankeyNode>([
    [
      "applications",
      { id: "applications", status: "applications", label: "Applications", count: analytics.total },
    ],
  ]);
  for (const flow of flows) {
    const id = nodeId(flow.target, flow.source);
    const node = nodes.get(id) ?? {
      id,
      status: flow.target,
      label: dashboardSankeyLabels[flow.target] ?? flow.target,
      count: 0,
    };
    node.count += flow.count;
    nodes.set(id, node);
  }
  const rank = (node: DashboardSankeyNode) => {
    const [source, status] = node.id.includes(":") ? node.id.split(":") : [node.id, ""];
    return order.indexOf(source ?? "") * (order.length + 1) + order.indexOf(status ?? "") + 1;
  };

  return {
    nodes: [...nodes.values()].sort((left, right) => rank(left) - rank(right)),
    links: flows.map((flow) => ({
      source: flow.source,
      target: nodeId(flow.target, flow.source),
      value: flow.count,
      ...(flow.companies.length > 0
        ? {
            companies: flow.companies.map((company) => ({
              id: company.jobApplicationId,
              ...(company.companyName ? { name: company.companyName } : {}),
              ...(company.companyLogoUrl ? { logoUrl: company.companyLogoUrl } : {}),
            })),
          }
        : {}),
    })),
  };
}

function mapTimeline(
  _application: ApiJobApplication | ApiJobApplicationDetail,
): TimelineMilestone[] {
  return [];
}

const applicationStatusLabels: Record<ApiApplicationStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  phone_screen: "Phone screen",
  interview: "Interview",
  offer: "Offer",
  declined: "Offer declined",
  rescinded: "Offer rescinded",
  rejected: "Rejected",
  ghosted: "Ghosted",
};

export function formatApplicationStatus(status: ApiApplicationStatus): string {
  return applicationStatusLabels[status] ?? status;
}

// The latest status change, matching the server's undo rule: archive and restore events don't
// count, and a change only stays undoable while the application still has the status it set.
function getUndoableStatusChange(
  events: ApiJobApplicationEvent[],
  currentStatus: ApiApplicationStatus,
): JobApplication["lastStatusChange"] {
  const [latest] = events
    .filter(
      (event) =>
        event.type === "status_changed" &&
        typeof event.metadata.from === "string" &&
        typeof event.metadata.to === "string",
    )
    .sort(
      (left, right) =>
        Date.parse(right.occurredAt) - Date.parse(left.occurredAt) ||
        Date.parse(right.createdAt) - Date.parse(left.createdAt),
    );
  if (!latest || latest.metadata.to !== currentStatus) return undefined;

  return {
    id: latest.id,
    from: latest.metadata.from as ApiApplicationStatus,
    to: latest.metadata.to as ApiApplicationStatus,
  };
}

function mapProcessingLog(events: ApiJobApplicationEvent[]): ProcessingLogItem[] {
  return events
    .filter((event) => event.type === "processing")
    .map((event) => ({
      item: {
        id: event.id,
        title: event.title,
        description: event.body ?? "Processing update",
        date: formatShortDate(event.occurredAt),
        status: event.title.toLowerCase().includes("failed") ? "failed" : "completed",
      } satisfies ProcessingLogItem,
      timestamp: Date.parse(event.occurredAt),
    }))
    .sort((left, right) => left.timestamp - right.timestamp)
    .map((entry) => entry.item);
}

function mapUpcomingInterviews(details: ApiJobApplicationDetail[]): UpcomingInterview[] {
  return details
    .flatMap((application) =>
      (application.followUps ?? [])
        .filter((followUp) => !followUp.reminderSentAt)
        .map((followUp) => ({
          followUp,
          application,
        })),
    )
    .map(({ followUp, application }) => ({
      scheduledAt: new Date(followUp.scheduledAt),
      followUp,
      application,
    }))
    .filter((item) => !Number.isNaN(item.scheduledAt.getTime()))
    .sort((left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime())
    .slice(0, 5)
    .map(({ scheduledAt, followUp, application }) => ({
      jobApplicationId: application.id,
      month: scheduledAt.toLocaleString(undefined, { month: "short" }),
      day: scheduledAt.getDate(),
      time: scheduledAt.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }),
      company:
        application.tracking.companyName ??
        application.scrapeBundle?.job.companyName ??
        "Unknown company",
      role: followUp.title,
      meetType: "follow_up",
      meetLabel: "Follow-up",
    }));
}

function mapFollowUp(followUp: ApiJobApplicationFollowUp): FollowUp {
  return {
    id: followUp.id,
    title: followUp.title,
    description: followUp.description,
    scheduledAt: followUp.scheduledAt,
    reminderSentAt: followUp.reminderSentAt,
    createdAt: followUp.createdAt,
  };
}

function mapMatchAnalysis(match: ApiMatchAnalysis): NonNullable<JobApplication["aiMatch"]> {
  return {
    score: match.matchScore,
    summary: match.interviewTips[0] ?? "AI analysis is available for this application.",
    requirements: mapRequirementMatches(match),
    recommendation: match.matchScore >= 70 ? "Apply to CV" : "Review before applying",
    summaryTips: match.summaryTips.map(mapCvTip),
    experienceTips: (match.experienceTips ?? []).map((entry) => ({
      index: entry.experienceIndex,
      tips: entry.tips.map(mapCvTip),
    })),
    educationTips: (match.educationTips ?? []).map((entry) => ({
      index: entry.educationIndex,
      tips: entry.tips.map(mapCvTip),
    })),
    projectTips: (match.projectTips ?? []).map((entry) => ({
      index: entry.projectIndex,
      tips: entry.tips.map(mapCvTip),
    })),
    skillsTips: mapCvListTips(match.skillsTips),
    certificationsTips: mapCvListTips(match.certificationsTips),
    gapQuestions: match.gapQuestions ?? [],
    keywords: uniqueCaseInsensitive([...match.strongSkills, ...match.missingSkills]),
  };
}

function uniqueCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter((value) => {
      const key = value.toLowerCase();
      if (!value || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function mapCvTip(tip: ApiCvTip): CvTip {
  return typeof tip === "string" ? { text: tip } : tip;
}

function mapCvListTips(tips: ApiCvListTip[] | undefined): CvListTip[] {
  return (tips ?? [])
    .map((tip) => (typeof tip === "string" ? { item: itemFromLegacyTip(tip), text: tip } : tip))
    .filter((tip) => tip.item.length > 0);
}

/**
 * Legacy list tips were free text like "Add Node.js — it's used across the team." Take the text
 * after a leading "Add" up to the first clause break, without splitting inside names such as
 * "Node.js", "CI/CD", or "Real-time".
 */
export function itemFromLegacyTip(tip: string): string {
  const afterAdd = tip.trim().replace(/^add\s+/i, "");
  return (afterAdd.split(/\s[—–-]\s|[,;:]|\.(?:\s|$)/)[0] ?? "").trim();
}

function mapRequirementMatches(
  match: ApiMatchAnalysis,
): NonNullable<JobApplication["aiMatch"]>["requirements"] {
  if (match.requirementEvaluations && match.requirementEvaluations.length > 0) {
    return match.requirementEvaluations.map((evaluation) => ({
      requirement: evaluation.requirement,
      status: evaluation.status,
      evidence: evaluation.evidence,
      ...(evaluation.priority ? { priority: evaluation.priority } : {}),
    }));
  }

  return [
    ...match.strongSkills.map((skill) => ({
      requirement: skill,
      status: "matched" as const,
      evidence: [],
    })),
    ...match.missingSkills.map((skill) => ({
      requirement: skill,
      status: "missing" as const,
      evidence: [],
    })),
  ];
}

function isJobApplicationDetail(
  application: ApiJobApplication | ApiJobApplicationDetail,
): application is ApiJobApplicationDetail {
  return "events" in application && "contacts" in application;
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date not set";
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatShortDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function formatProcessingStatus(status: string, failureReason?: string): string {
  if (status === "queued") {
    return failureReason ? "Retry scheduled" : "Scraping waiting";
  }

  if (status === "scraping") {
    return "Extracting LinkedIn details";
  }

  if (status === "scraped") {
    return "Ready for analysis";
  }

  return status
    .split("_")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function formatRelativeDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const days = Math.round((Date.now() - date.getTime()) / 86_400_000);

  if (days <= 0) {
    return "Today";
  }

  if (days === 1) {
    return "Yesterday";
  }

  return `${days} days ago`;
}

function getDomain(value?: string): string {
  if (!value) {
    return "No source";
  }

  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "No source";
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getProfileTitle(profile: ApiProfile): string {
  return profile.profession?.trim() ?? "";
}

function formatPeriod(startDate?: string, endDate?: string): string {
  if (!startDate && !endDate) {
    return "Dates not set";
  }

  return `${startDate ?? "Start not set"} - ${endDate ?? "Present"}`;
}
