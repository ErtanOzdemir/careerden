import { describe, expect, it } from "vitest";
import {
  mapApiDashboardStats,
  mapApiJobApplicationToUi,
  mapApiProfileToUi,
  mapApiStatusToUi,
} from "./mappers";
import type { ApiJobApplicationAnalytics, ApiJobApplicationDetail, ApiProfile } from "./types";
import { richDocumentToPlainText } from "@careerden/contracts";

describe("API mappers", () => {
  it("maps API status values to UI labels", () => {
    expect(mapApiStatusToUi("saved")).toBe("Saved");
    expect(mapApiStatusToUi("applied")).toBe("Applied");
    expect(mapApiStatusToUi("phone_screen")).toBe("Interviewing");
    expect(mapApiStatusToUi("interview")).toBe("Interviewing");
    expect(mapApiStatusToUi("offer")).toBe("Offer");
    expect(mapApiStatusToUi("rejected")).toBe("Rejected");
    expect(mapApiStatusToUi("ghosted")).toBe("Ghosted");
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
    expect(mapped.aiMatch?.keywords).toContainEqual({ keyword: "React", match: true });
    expect(mapped.aiMatch?.keywords).toContainEqual({ keyword: "Node.js", match: false });
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
    expect(mapped.aiMatch?.missingSkillResources).toEqual([
      {
        skill: "Node.js",
        title: "Node.js Learn",
        type: "documentation",
        url: "https://nodejs.org/en/learn",
        reason: "Covers Node.js fundamentals for backend JavaScript work.",
      },
    ]);
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
    expect(stats.sankey).toEqual({
      nodes: [
        { id: "all-applications", label: "All applications", count: 4 },
        { id: "applied", label: "Applied", count: 1 },
        { id: "interview", label: "Interview", count: 1 },
        { id: "offer", label: "Offer", count: 1 },
        { id: "rejected", label: "Rejected", count: 1 },
      ],
      links: [
        { source: "all-applications", target: "applied", value: 1 },
        { source: "all-applications", target: "interview", value: 1 },
        { source: "all-applications", target: "offer", value: 1 },
        { source: "all-applications", target: "rejected", value: 1 },
      ],
    });
  });

  it("maps every current application status into Sankey data in canonical order", () => {
    const analytics: ApiJobApplicationAnalytics = {
      applicationsOverTime: {},
      averageTimeToResponseDays: null,
      byStatus: {
        saved: 1,
        applied: 2,
        phone_screen: 3,
        interview: 4,
        offer: 5,
        rejected: 6,
        ghosted: 7,
      },
      interviewConversionRate: 0,
      offers: 5,
      rejections: 6,
      responseRate: 0,
      total: 28,
    };

    const stats = mapApiDashboardStats(analytics, []);

    expect(stats.sankey.nodes.map((node) => node.label)).toEqual([
      "All applications",
      "Saved",
      "Applied",
      "Phone screen",
      "Interview",
      "Offer",
      "Rejected",
      "Ghosted",
    ]);
    expect(stats.sankey.links.map((link) => link.value)).toEqual([1, 2, 3, 4, 5, 6, 7]);
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

  it("maps profile experience descriptions into AI comparisons", () => {
    const application = createApplicationDetail();
    const profile = createProfile();
    application.matchAnalysis = {
      ...application.matchAnalysis,
      recommendedAchievements: ["Enhanced role description."],
    };

    const mapped = mapApiJobApplicationToUi(application, profile);

    expect(mapped.aiMatch?.experienceOptimizations).toHaveLength(2);
    expect(mapped.aiMatch?.experienceOptimizations?.[0]).toEqual({
      title: "Frontend Engineer",
      company: "Acme",
      items: [
        {
          actual: "Built product experiences for SaaS teams.",
          actualRichText: {
            version: 1,
            blocks: [
              {
                type: "paragraph",
                children: [{ type: "text", text: "Built product experiences for SaaS teams." }],
              },
            ],
          },
          enhanced: "Enhanced role description.",
          kind: "description",
        },
      ],
    });
    expect(mapped.aiMatch?.experienceOptimizations?.[1]).toEqual({
      title: "UI Engineer",
      company: "Beta",
      items: [],
    });
  });

  it("builds a fallback draft from the analysis when no document content is stored yet", () => {
    const application = createApplicationDetail();
    application.documentContent = null;
    application.matchAnalysis = {
      ...application.matchAnalysis!,
      experienceEnhancements: [
        { experienceIndex: 0, enhancedDescription: "Built product experiences" },
      ],
    };

    const mapped = mapApiJobApplicationToUi(application);
    const content = mapped.documentContent!;

    expect(content.formatVersion).toBe(2);
    expect(richDocumentToPlainText(content.experienceEnhancements[0]!.description!)).toBe(
      "Built product experiences",
    );
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
      customizedSummary: "Frontend engineer focused on React.",
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
      recommendedAchievements: ["Built accessible UI with React."],
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
