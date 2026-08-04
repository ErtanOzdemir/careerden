import type {
  ApiApplicationStatus,
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
  DashboardStats,
  FollowUp,
  JobApplication,
  InterestLevel,
  ProcessingLogItem,
  Profile,
  TimelineMilestone,
  UpcomingInterview,
} from "../types";
import { mergeRichDocumentsAsProse, richDocumentFromText } from "../lib/rich-document.js";

export function mapApiStatusToUi(status: ApiApplicationStatus): ApplicationStatus {
  switch (status) {
    case "saved":
      return "Saved";
    case "offer":
      return "Offer";
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
    aiMatch: detail?.matchAnalysis ? mapMatchAnalysis(detail.matchAnalysis, profile) : undefined,
    documentContent:
      detail?.documentContent ??
      (detail?.matchAnalysis ? mapInitialDocumentContent(detail.matchAnalysis) : undefined),
  };
}

function getAnalysisSkipReason(
  events: ApiJobApplicationEvent[],
): JobApplication["analysisSkipReason"] {
  return events.some((event) => event.metadata.reason === "insufficient_credits")
    ? "insufficient_credits"
    : undefined;
}

function mapInitialDocumentContent(match: ApiMatchAnalysis) {
  return {
    coverLetterContent: richDocumentFromText(match.coverLetterContent ?? ""),
    customizedSummary: richDocumentFromText(match.customizedSummary),
    formatVersion: 2 as const,
    experienceEnhancements: (match.experienceEnhancements ?? []).map((enhancement) => {
      const description = mergeRichDocumentsAsProse(
        enhancement.enhancedDescription
          ? richDocumentFromText(enhancement.enhancedDescription)
          : undefined,
        ...(enhancement.enhancedAchievements ?? []).map(richDocumentFromText),
      );
      return {
        experienceIndex: enhancement.experienceIndex,
        ...(description ? { description } : {}),
        achievements: [],
      };
    }),
    skillSuggestions: match.skillSuggestions ?? [],
    educationEnhancements: (match.educationEnhancements ?? []).map((enhancement) => {
      const description = mergeRichDocumentsAsProse(
        enhancement.enhancedDescription
          ? richDocumentFromText(enhancement.enhancedDescription)
          : undefined,
        ...(enhancement.enhancedAchievements ?? []).map(richDocumentFromText),
      );
      return {
        educationIndex: enhancement.educationIndex,
        ...(description ? { description } : {}),
        achievements: [],
      };
    }),
    projectEnhancements: (match.projectEnhancements ?? []).map((enhancement) => {
      const description = mergeRichDocumentsAsProse(
        enhancement.enhancedDescription
          ? richDocumentFromText(enhancement.enhancedDescription)
          : undefined,
        ...(enhancement.enhancedAchievements ?? []).map(richDocumentFromText),
      );
      return {
        projectIndex: enhancement.projectIndex,
        ...(description ? { description } : {}),
        achievements: [],
      };
    }),
    certificationSuggestions: match.certificationSuggestions ?? [],
    selections: {
      experience: {},
      education: {},
      projects: {},
    },
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

const dashboardSankeyStatuses: Array<{ id: ApiApplicationStatus; label: string }> = [
  { id: "saved", label: "Saved" },
  { id: "applied", label: "Applied" },
  { id: "phone_screen", label: "Phone screen" },
  { id: "interview", label: "Interview" },
  { id: "offer", label: "Offer" },
  { id: "rejected", label: "Rejected" },
  { id: "ghosted", label: "Ghosted" },
];

function mapDashboardSankey(analytics: ApiJobApplicationAnalytics): DashboardStats["sankey"] {
  if (analytics.total === 0) {
    return { nodes: [], links: [] };
  }

  const statuses = dashboardSankeyStatuses
    .map(({ id, label }) => ({ id, label, count: analytics.byStatus[id] ?? 0 }))
    .filter((status) => status.count > 0);

  return {
    nodes: [
      { id: "all-applications", label: "All applications", count: analytics.total },
      ...statuses,
    ],
    links: statuses.map((status) => ({
      source: "all-applications",
      target: status.id,
      value: status.count,
    })),
  };
}

function mapTimeline(
  _application: ApiJobApplication | ApiJobApplicationDetail,
): TimelineMilestone[] {
  return [];
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

function mapMatchAnalysis(
  match: ApiMatchAnalysis,
  profile?: ApiProfile,
): NonNullable<JobApplication["aiMatch"]> {
  const recommendationQueue = [...match.recommendedAchievements];
  const profileHighlights = profile?.experience
    .map((experience) => experience.description)
    .filter(Boolean);
  const originalHighlights = profileHighlights ?? [];
  const currentSummary = profile?.summary ?? profile?.headline ?? "Current profile summary";
  const yourSkills =
    profile?.skills && profile.skills.length > 0 ? profile.skills : match.strongSkills;

  return {
    score: match.matchScore,
    summary: match.interviewTips[0] ?? "AI analysis is available for this application.",
    keywords: [
      ...match.strongSkills.map((skill) => ({ keyword: skill, match: true })),
      ...match.missingSkills.map((skill) => ({ keyword: skill, match: false })),
    ],
    requirements: mapRequirementMatches(match),
    recommendation: match.matchScore >= 70 ? "Apply to CV" : "Review before applying",
    currentSummary,
    currentSummaryRichText: profile?.summaryRichText ?? richDocumentFromText(currentSummary),
    enhancedSummary: match.customizedSummary,
    missingSkillResources: (match.missingSkillResources ?? []).filter((resource) =>
      isHttpUrl(resource.url),
    ),
    bulletOptimizations: match.recommendedAchievements.map((achievement, index) => ({
      original: originalHighlights[index] ?? "No matching profile highlight",
      enhanced: achievement,
    })),
    experienceOptimizations: profile?.experience.map((experience, index) => {
      const enhancement = match.experienceEnhancements?.find(
        (item) => item.experienceIndex === index,
      );

      return {
        title: experience.title,
        company: experience.company,
        items: [
          ...(experience.description
            ? [
                {
                  actual: experience.description,
                  actualRichText:
                    experience.descriptionRichText ?? richDocumentFromText(experience.description),
                  enhanced: enhancement?.enhancedDescription ?? recommendationQueue.shift(),
                  kind: "description" as const,
                },
              ]
            : []),
        ],
      };
    }),
    yourSkills,
    suggestedSkills: match.missingSkills,
    educationOptimizations: profile?.education.map((education, index) => {
      const enhancement = match.educationEnhancements?.find(
        (item) => item.educationIndex === index,
      );
      return {
        institution: education.institution,
        degree: [education.degree, education.field].filter(Boolean).join(", ") || "Education",
        items: enhancement?.enhancedDescription
          ? [
              {
                actual: [education.degree, education.field].filter(Boolean).join(", "),
                enhanced: enhancement.enhancedDescription,
                kind: "description" as const,
              },
            ]
          : [],
      };
    }),
    projectOptimizations: profile?.projects.map((project, index) => {
      const enhancement = match.projectEnhancements?.find((item) => item.projectIndex === index);
      return {
        name: project.name,
        items: [
          ...(project.description
            ? [
                {
                  actual: project.description,
                  actualRichText:
                    project.descriptionRichText ?? richDocumentFromText(project.description),
                  enhanced: enhancement?.enhancedDescription,
                  kind: "description" as const,
                },
              ]
            : []),
          ...project.achievements.map((achievement, achievementIndex) => ({
            actual: achievement,
            enhanced: enhancement?.enhancedAchievements?.[achievementIndex],
            kind: "achievement" as const,
          })),
        ],
      };
    }),
  };
}

function mapRequirementMatches(
  match: ApiMatchAnalysis,
): NonNullable<JobApplication["aiMatch"]>["requirements"] {
  if (match.requirementEvaluations && match.requirementEvaluations.length > 0) {
    return match.requirementEvaluations.map((evaluation) => ({
      requirement: evaluation.requirement,
      status: evaluation.status,
      evidence: evaluation.evidence,
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
