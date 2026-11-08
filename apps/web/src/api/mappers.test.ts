import { describe, expect, it } from "vitest";
import {
  itemFromLegacyTip,
  mapApiDashboardStats,
  mapApiJobApplicationToUi,
  mapApiProfileToUi,
  mapApiStatusToUi,
  mapUiStatusToApi,
} from "./mappers";
import type {
  ApiApplicationStatus,
  ApiJobApplicationAnalytics,
  ApiJobApplicationDetail,
  ApiProfile,
} from "./types";
import { richDocumentToPlainText } from "@careerden/contracts";

describe("API mappers", () => {
  it("exposes the latest status change while the application still has its status", () => {
    const event = (id: string, type: string, metadata: Record<string, unknown>, at: string) => ({
      createdAt: at,
      id,
      jobApplicationId: "job-1",
      metadata,
      occurredAt: at,
      title: "",
      type,
    });
    const detail = {
      ...createApplicationDetail(),
      events: [
        event("event-a", "status_changed", { from: "applied", to: "interview" }, "2026-06-02"),
        event("event-b", "status_changed", { archivedAt: "2026-06-03" }, "2026-06-03"),
        event("event-c", "status_changed", { from: "saved", to: "applied" }, "2026-06-01"),
      ],
    };

    expect(mapApiJobApplicationToUi(detail).lastStatusChange).toEqual({
      id: "event-a",
      from: "applied",
      to: "interview",
    });
    expect(
      mapApiJobApplicationToUi({
        ...detail,
        tracking: { ...detail.tracking, applicationStatus: "offer" },
      }).lastStatusChange,
    ).toBeUndefined();
  });

  it("maps AI provider failures and drops ones this client does not understand", () => {
    const failedEvent = {
      createdAt: "2026-06-02",
      id: "event-failed",
      jobApplicationId: "job-1",
      metadata: { aiFailure: { category: "rate_limited", provider: "gemini", statusCode: 429 } },
      occurredAt: "2026-06-02",
      title: "AI analysis failed",
      body: "The provider is temporarily limiting requests. Try again in a few minutes.",
      type: "processing",
    };
    const detail = {
      ...createApplicationDetail(),
      status: "failed",
      aiFailure: { category: "rate_limited" as const, provider: "gemini", statusCode: 429 },
      events: [failedEvent],
    };

    const mapped = mapApiJobApplicationToUi(detail);
    expect(mapped.processingAiFailure).toEqual({
      category: "rate_limited",
      provider: "gemini",
      statusCode: 429,
    });
    expect(mapped.processingLog?.[0]).toMatchObject({
      status: "failed",
      aiFailure: { category: "rate_limited" },
    });
    expect(
      mapApiJobApplicationToUi({
        ...detail,
        aiFailure: { category: "from_the_future" } as never,
      }).processingAiFailure,
    ).toBeUndefined();
  });

  it("round-trips declined and rescinded offer statuses", () => {
    expect(mapApiStatusToUi("declined")).toBe("Declined");
    expect(mapApiStatusToUi("rescinded")).toBe("Rescinded");
    expect(mapUiStatusToApi("Declined")).toBe("declined");
    expect(mapUiStatusToApi("Rescinded")).toBe("rescinded");
  });

  it("maps API status values to UI labels", () => {
    expect(mapApiStatusToUi("saved")).toBe("Saved");
    expect(mapApiStatusToUi("applied")).toBe("Applied");
    expect(mapApiStatusToUi("phone_screen")).toBe("Interviewing");
    expect(mapApiStatusToUi("interview")).toBe("Interviewing");
    expect(mapApiStatusToUi("offer")).toBe("Offer");
    expect(mapApiStatusToUi("rejected")).toBe("Rejected");
    expect(mapApiStatusToUi("ghosted")).toBe("Ghosted");
  });

  it("names LinkedIn throttling instead of reporting a generic retry", () => {
    const application = createApplicationDetail();
    application.status = "queued";
    application.failureReason =
      "scrape_rate_limited: LinkedIn public fetch failed: 429 Too Many Requests";

    expect(mapApiJobApplicationToUi(application).processingStatusLabel).toBe(
      "LinkedIn is rate limiting",
    );

    application.failureReason = "scrape_blocked: LinkedIn public fetch failed: 403 Forbidden";

    expect(mapApiJobApplicationToUi(application).processingStatusLabel).toBe("Retry scheduled");
  });

  it("preserves the active analysis attempt for queued UI state", () => {
    const application = createApplicationDetail();
    application.analysisAttemptId = "attempt-1";
    application.status = "scraped";

    expect(mapApiJobApplicationToUi(application)).toMatchObject({
      analysisAttemptId: "attempt-1",
      processingStatus: "scraped",
    });
  });

  it("maps job application detail into the existing UI shape", () => {
    const application = createApplicationDetail();

    const mapped = mapApiJobApplicationToUi(application);

    expect(mapped.company).toBe("Acme");
    expect(mapped.companyDescription).toBe("Acme builds reliable products.");
    expect(mapped.companyWebsiteUrl).toBe("https://www.acme.example/careers");
    expect(mapped.logo).toBe("http://localhost:9000/signed-logo");
    expect(mapped.matchScore).toBe(82);
    expect(mapped.role).toBe("Frontend Engineer");
    expect(mapped.descriptionHtml).toBe("<p>Build <strong>product</strong> UI.</p>");
    expect(mapped.domain).toBe("linkedin.com");
    expect(mapped.status).toBe("Interviewing");
    expect(mapped.interestLevel).toBe("high");
    expect(mapped.salaryMinAmount).toBe(90_000);
    expect(mapped.salaryMaxAmount).toBe(120_000);
    expect(mapped.salaryCurrency).toBe("EUR");
    expect(mapped.salaryPeriod).toBe("yearly");
    expect(mapped.salaryType).toBe("gross");
    expect(mapped.workStyle).toBe("hybrid");
    expect(mapped.contacts).toEqual([
      {
        email: "sarah.hughes@example.com",
        initials: "SH",
        name: "Sarah Hughes",
        phone: "+1 555 0101",
        role: "Recruiter",
      },
    ]);
    expect(mapped.timeline).toEqual([]);
    expect(mapped.processingStatusLabel).toBe("Completed");
    expect(mapped.applicationPackPreferences).toEqual({
      language: "auto",
      tone: "professional",
    });
    expect(mapped.profileReadiness).toEqual({ state: "ready", warnings: [] });
    expect(mapped.processingLog?.map((item) => item.title)).toEqual(["Scraping started"]);
    expect(mapped.followUps).toHaveLength(1);
    expect(mapped.followUps?.[0]?.title).toBe("Send thank-you email");
    expect(mapped.followUps?.[0]?.description).toBe("Ask about the product roadmap.");
    expect(mapped.aiMatch?.score).toBe(82);
    expect(mapped.aiMatch?.requirements).toEqual([
      {
        requirement: "Build React product UI",
        status: "matched",
        evidence: ["Built accessible UI with React."],
      },
      {
        requirement: "Work with backend APIs",
        status: "partial",
        evidence: ["Frontend API integration experience."],
      },
      {
        requirement: "Ship Node.js services",
        status: "missing",
        evidence: [],
      },
    ]);
    expect(mapped.aiMatch?.summaryTips).toEqual([{ text: "Lead with the React work." }]);
    expect(mapped.aiMatch?.experienceTips).toEqual([
      { index: 0, tips: [{ text: "Mention the accessibility work." }] },
    ]);
  });

  it("maps structured tips as-is and converts legacy string list tips into item names", () => {
    const application = createApplicationDetail();
    application.matchAnalysis = {
      ...application.matchAnalysis!,
      summaryTips: [{ text: "Lead with React.", requirement: "React", evidence: "Built React" }],
      skillsTips: [
        "Add Node.js — it's used across the team.",
        { item: "CI/CD", text: "Add CI/CD." },
      ],
      certificationsTips: ["Add AWS Certified Developer."],
    };

    const mapped = mapApiJobApplicationToUi(application);

    expect(mapped.aiMatch?.summaryTips).toEqual([
      { text: "Lead with React.", requirement: "React", evidence: "Built React" },
    ]);
    expect(mapped.aiMatch?.skillsTips).toEqual([
      { item: "Node.js", text: "Add Node.js — it's used across the team." },
      { item: "CI/CD", text: "Add CI/CD." },
    ]);
    expect(mapped.aiMatch?.certificationsTips).toEqual([
      { item: "AWS Certified Developer", text: "Add AWS Certified Developer." },
    ]);
  });

  it("maps gap questions, requirement priorities, and deduplicated job keywords", () => {
    const application = createApplicationDetail();
    application.matchAnalysis = {
      ...application.matchAnalysis!,
      strongSkills: ["React", "TypeScript"],
      missingSkills: ["react", "GraphQL"],
      requirementEvaluations: [
        { requirement: "GraphQL", status: "missing", evidence: [], priority: "nice" },
      ],
      gapQuestions: [{ question: "Did you use GraphQL?", field: { type: "experience", index: 0 } }],
    };

    const mapped = mapApiJobApplicationToUi(application);

    expect(mapped.aiMatch?.keywords).toEqual(["React", "TypeScript", "GraphQL"]);
    expect(mapped.aiMatch?.requirements).toEqual([
      { requirement: "GraphQL", status: "missing", evidence: [], priority: "nice" },
    ]);
    expect(mapped.aiMatch?.gapQuestions).toEqual([
      { question: "Did you use GraphQL?", field: { type: "experience", index: 0 } },
    ]);
  });

  it("defaults gap questions to an empty list for older analyses", () => {
    const application = createApplicationDetail();
    delete application.matchAnalysis!.gapQuestions;

    expect(mapApiJobApplicationToUi(application).aiMatch?.gapQuestions).toEqual([]);
  });

  it("extracts item names from legacy tips without splitting inside names", () => {
    expect(itemFromLegacyTip("Add Node.js — it's used across the team.")).toBe("Node.js");
    expect(itemFromLegacyTip("Add Real-time systems, since the team streams data.")).toBe(
      "Real-time systems",
    );
    expect(itemFromLegacyTip("add CI/CD - pipelines are part of the role")).toBe("CI/CD");
    expect(itemFromLegacyTip("Kubernetes")).toBe("Kubernetes");
  });

  it("maps an unset priority to an unset interest level", () => {
    const application = createApplicationDetail();
    application.tracking.priority = undefined;

    expect(mapApiJobApplicationToUi(application).interestLevel).toBeUndefined();
  });

  it("does not expose a non-HTTP company website URL", () => {
    const application = createApplicationDetail();
    application.scrapeBundle.companyLinkedIn = {
      name: "Acme",
      raw: {},
      websiteUrl: "javascript:alert(1)",
    };

    expect(mapApiJobApplicationToUi(application).companyWebsiteUrl).toBeUndefined();
  });

  it("uses the first non-blank normalized company description", () => {
    const application = createApplicationDetail();
    application.scrapeBundle.companyLinkedIn = {
      name: "Acme",
      description: "   ",
      raw: {},
    };
    application.scrapeBundle.companyWebsite = {
      name: "Acme",
      description: "  Acme builds tools for product teams.  ",
      raw: {},
    };
    application.scrapeBundle.careerPage = {
      name: "Acme",
      description: "Join Acme.",
      raw: {},
    };

    expect(mapApiJobApplicationToUi(application).companyDescription).toBe(
      "Acme builds tools for product teams.",
    );
  });

  it("prefers manually entered company context", () => {
    const application = createApplicationDetail();
    application.scrapeBundle.companyManual = {
      name: "Manual Co",
      description: "Pasted company description.",
      raw: { strategy: "manual" },
      websiteUrl: "https://manual.example",
    };

    expect(mapApiJobApplicationToUi(application)).toMatchObject({
      companyDescription: "Pasted company description.",
      companyWebsiteUrl: "https://manual.example",
    });
  });

  it("omits blank company descriptions", () => {
    const application = createApplicationDetail();
    application.scrapeBundle.companyLinkedIn = {
      name: "Acme",
      description: "   ",
      raw: {},
    };

    expect(mapApiJobApplicationToUi(application).companyDescription).toBeUndefined();
  });

  it("maps pipeline flows to stage nodes and company ribbons", () => {
    const stats = mapApiDashboardStats(
      {
        applicationsOverTime: {},
        averageTimeToResponseDays: null,
        byStatus: { applied: 1, rejected: 1 },
        interviewConversionRate: 0,
        offers: 0,
        rejections: 1,
        responseRate: 0,
        total: 2,
        pipeline: [
          {
            source: "applications",
            target: "applied",
            count: 2,
            companies: [
              { jobApplicationId: "job-1", companyName: "Acme", companyLogoUrl: "/logo.png" },
              { jobApplicationId: "job-2" },
            ],
          },
          {
            source: "applied",
            target: "rejected",
            count: 1,
            companies: [{ jobApplicationId: "job-2" }],
          },
        ],
      },
      [],
    );

    expect(stats.sankey.nodes).toEqual([
      { id: "applications", status: "applications", label: "Applications", count: 2 },
      { id: "applied", status: "applied", label: "Applied", count: 2 },
      { id: "applied:rejected", status: "rejected", label: "Rejected", count: 1 },
    ]);
    expect(stats.sankey.links[0]).toEqual({
      source: "applications",
      target: "applied",
      value: 2,
      companies: [{ id: "job-1", name: "Acme", logoUrl: "/logo.png" }, { id: "job-2" }],
    });
    expect(stats.sankey.links[1]).toMatchObject({
      source: "applied",
      target: "applied:rejected",
      value: 1,
    });
  });

  it("maps analytics and details into dashboard stats", () => {
    const analytics: ApiJobApplicationAnalytics = {
      applicationsOverTime: { "2026-06-01": 1, "2026-06-02": 2 },
      averageTimeToResponseDays: 2,
      byStatus: { applied: 1, interview: 1, offer: 1, rejected: 1 },
      interviewConversionRate: 0.25,
      offers: 1,
      rejections: 1,
      responseRate: 0.5,
      total: 4,
    };

    const stats = mapApiDashboardStats(analytics, [createApplicationDetail()]);

    expect(stats.totalApplications).toBe(4);
    expect(stats.activeInterviews).toBe(1);
    expect(stats.rejectionRate).toBe(25);
    expect(stats.weeklyTrend).toEqual([1, 2]);
    expect(stats.upcomingInterviews).toHaveLength(1);
    expect(stats.upcomingInterviews[0]?.jobApplicationId).toBe("job-1");
  });

  it("orders stages canonically, each followed by the outcomes it ended in", () => {
    const flow = (source: "applications" | ApiApplicationStatus, target: ApiApplicationStatus) => ({
      source,
      target,
      count: 1,
      companies: [],
    });
    const analytics: ApiJobApplicationAnalytics = {
      applicationsOverTime: {},
      averageTimeToResponseDays: null,
      byStatus: {},
      interviewConversionRate: 0,
      offers: 1,
      rejections: 1,
      responseRate: 0,
      total: 3,
      pipeline: [
        flow("applications", "applied"),
        flow("applied", "ghosted"),
        flow("applications", "applied"),
        flow("applied", "interview"),
        flow("interview", "offer"),
        flow("offer", "rejected"),
        flow("offer", "declined"),
        flow("offer", "rescinded"),
        flow("applied", "phone_screen"),
        flow("applications", "saved"),
      ],
    };

    const stats = mapApiDashboardStats(analytics, []);

    expect(stats.sankey.nodes.map((node) => node.id)).toEqual([
      "applications",
      "saved",
      "applied",
      "applied:ghosted",
      "phone_screen",
      "interview",
      "offer",
      "offer:declined",
      "offer:rescinded",
      "offer:rejected",
    ]);
    expect(stats.sankey.links).toHaveLength(10);
  });

  it("returns empty Sankey data when there are no applications", () => {
    const analytics: ApiJobApplicationAnalytics = {
      applicationsOverTime: {},
      averageTimeToResponseDays: null,
      byStatus: {},
      interviewConversionRate: 0,
      offers: 0,
      rejections: 0,
      responseRate: 0,
      total: 0,
    };

    expect(mapApiDashboardStats(analytics, []).sankey).toEqual({ nodes: [], links: [] });
  });

  it("falls back to legacy skill buckets when requirement evaluations are absent", () => {
    const application = createApplicationDetail();
    application.matchAnalysis = {
      ...application.matchAnalysis,
      requirementEvaluations: undefined,
    };

    const mapped = mapApiJobApplicationToUi(application);

    expect(mapped.aiMatch?.requirements).toEqual([
      {
        requirement: "React",
        status: "matched",
        evidence: [],
      },
      {
        requirement: "Node.js",
        status: "missing",
        evidence: [],
      },
    ]);
  });

  it("maps profile data without requiring mock-only fields", () => {
    const profile: ApiProfile = {
      autoRunMatchAnalysis: true,
      certifications: [],
      createdAt: "2026-06-01T00:00:00.000Z",
      education: [],
      email: "person@example.com",
      experience: [
        {
          company: "Acme",
          description: "Built product UI",
          startDate: "2024",
          title: "Designer",
        },
      ],
      fullName: "Ada Lovelace",
      headline: "Product Designer | Design Systems",
      id: "profile-1",
      links: [],
      location: "Remote",
      projects: [{ achievements: [], name: "Portfolio", skills: [], url: "https://example.com" }],
      skills: ["Figma"],
      summary: "Designs software.",
      updatedAt: "2026-06-01T00:00:00.000Z",
    };

    const mapped = mapApiProfileToUi(profile);

    expect(mapped.title).toBe("");
    expect(mapped.portfolio).toBe("https://example.com");
    expect(mapped.experiences[0]?.period).toBe("2024 - Present");
    expect(mapped.skills[0]?.skills).toEqual(["Figma"]);
  });

  it("builds a fallback draft from the profile's own text when no document content is stored yet", () => {
    const application = createApplicationDetail();
    application.documentContent = null;
    const profile = createProfile();

    const mapped = mapApiJobApplicationToUi(application, profile);
    const content = mapped.documentContent!;

    expect(content.formatVersion).toBe(2);
    expect(richDocumentToPlainText(content.customizedSummary)).toBe("Builds product UI.");
    expect(richDocumentToPlainText(content.experienceEnhancements[0]!.description!)).toBe(
      "Built product experiences for SaaS teams.",
    );
    expect(content.skillSuggestions).toEqual(["React"]);
  });
});

function createApplicationDetail(): ApiJobApplicationDetail {
  return {
    contacts: [
      {
        createdAt: "2026-06-01T00:00:00.000Z",
        id: "contact-1",
        jobApplicationId: "job-1",
        email: "sarah.hughes@example.com",
        name: "Sarah Hughes",
        phone: "+1 555 0101",
        role: "Recruiter",
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
    ],
    createdAt: "2026-06-01T00:00:00.000Z",
    documents: [],
    events: [
      {
        createdAt: "2026-06-01T00:00:00.000Z",
        id: "event-1",
        jobApplicationId: "job-1",
        metadata: {},
        occurredAt: "2026-06-01T00:00:00.000Z",
        title: "Application created",
        type: "created",
      },
      {
        createdAt: "2026-06-01T00:00:00.000Z",
        id: "event-2",
        jobApplicationId: "job-1",
        metadata: {},
        occurredAt: "2026-06-01T00:01:00.000Z",
        title: "Scraping started",
        type: "processing",
      },
    ],
    companyLogoUrl: "http://localhost:9000/signed-logo",
    applicationPackPreferences: {
      language: "auto",
      tone: "professional",
    },
    id: "job-1",
    matchAnalysis: {
      summaryTips: ["Lead with the React work."],
      interviewTips: ["Prepare React examples."],
      matchScore: 82,
      missingSkills: ["Node.js"],
      missingSkillResources: [
        {
          skill: "Node.js",
          title: "Node.js Learn",
          type: "documentation",
          url: "https://nodejs.org/en/learn",
          reason: "Covers Node.js fundamentals for backend JavaScript work.",
        },
      ],
      requirementEvaluations: [
        {
          requirement: "Build React product UI",
          status: "matched",
          evidence: ["Built accessible UI with React."],
        },
        {
          requirement: "Work with backend APIs",
          status: "partial",
          evidence: ["Frontend API integration experience."],
        },
        {
          requirement: "Ship Node.js services",
          status: "missing",
          evidence: [],
        },
      ],
      experienceTips: [{ experienceIndex: 0, tips: ["Mention the accessibility work."] }],
      strongSkills: ["React"],
    },
    profileId: "profile-1",
    profileReadiness: { state: "ready", warnings: [] },
    scrapeBundle: {
      companyLinkedIn: {
        name: "Acme",
        description: "Acme builds reliable products.",
        raw: {},
        websiteUrl: "https://www.acme.example/careers",
      },
      job: {
        companyName: "Acme",
        description: "Build product UI.",
        descriptionHtml: "<p>Build <strong>product</strong> UI.</p>",
        location: "Remote",
        raw: {},
        requirements: ["React"],
        title: "Frontend Engineer",
      },
    },
    sourceUrl: "https://www.linkedin.com/jobs/view/1",
    status: "completed",
    tracking: {
      applicationStatus: "interview",
      companyName: "Acme",
      dateApplied: "2026-06-01",
      metadata: {},
      priority: "high",
      roleTitle: "Frontend Engineer",
      salaryMinAmount: 90_000,
      salaryMaxAmount: 120_000,
      salaryCurrency: "EUR",
      salaryPeriod: "yearly",
      salaryType: "gross",
      workStyle: "hybrid",
      tags: ["Remote"],
    },
    followUps: [
      {
        id: "follow-up-1",
        jobApplicationId: "job-1",
        profileId: "profile-1",
        title: "Send thank-you email",
        description: "Ask about the product roadmap.",
        scheduledAt: "2026-06-03T13:30:00.000Z",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
    ],
    updatedAt: "2026-06-02T00:00:00.000Z",
  };
}

function createProfile(): ApiProfile {
  return {
    autoGenerateDocuments: true,
    autoRunMatchAnalysis: true,
    followUpRemindersEnabled: true,
    certifications: [],
    createdAt: "2026-06-01T00:00:00.000Z",
    education: [],
    email: "person@example.com",
    experience: [
      {
        company: "Acme",
        description: "Built product experiences for SaaS teams.",
        startDate: "2024",
        title: "Frontend Engineer",
      },
      {
        company: "Beta",
        startDate: "2022",
        title: "UI Engineer",
      },
    ],
    fullName: "Ada Lovelace",
    headline: "Frontend Engineer",
    id: "profile-1",
    location: "Remote",
    projects: [],
    skills: ["React"],
    summary: "Builds product UI.",
    updatedAt: "2026-06-01T00:00:00.000Z",
  };
}
