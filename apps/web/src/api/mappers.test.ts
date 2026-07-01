import { describe, expect, it } from "vitest";
import {
  mapApiDashboardStats,
  mapApiJobApplicationToUi,
  mapApiPriorityToUi,
  mapApiProfileToUi,
  mapApiStatusToUi,
} from "./mappers";
import type { ApiJobApplicationAnalytics, ApiJobApplicationDetail, ApiProfile } from "./types";

describe("API mappers", () => {
  it("maps API status and priority values to UI labels", () => {
    expect(mapApiStatusToUi("applied")).toBe("Applied");
    expect(mapApiStatusToUi("phone_screen")).toBe("Interviewing");
    expect(mapApiStatusToUi("interview")).toBe("Interviewing");
    expect(mapApiStatusToUi("offer")).toBe("Offer");
    expect(mapApiStatusToUi("rejected")).toBe("Rejected");
    expect(mapApiPriorityToUi("high")).toBe("High");
    expect(mapApiPriorityToUi("medium")).toBe("Mid");
    expect(mapApiPriorityToUi("low")).toBe("Low");
  });

  it("maps job application detail into the existing UI shape", () => {
    const application = createApplicationDetail();

    const mapped = mapApiJobApplicationToUi(application);

    expect(mapped.company).toBe("Acme");
    expect(mapped.logo).toBe("http://localhost:9000/signed-logo");
    expect(mapped.matchScore).toBe(82);
    expect(mapped.role).toBe("Frontend Engineer");
    expect(mapped.descriptionHtml).toBe("<p>Build <strong>product</strong> UI.</p>");
    expect(mapped.domain).toBe("linkedin.com");
    expect(mapped.status).toBe("Interviewing");
    expect(mapped.priority).toBe("High");
    expect(mapped.contacts).toEqual([
      {
        email: "sarah.hughes@example.com",
        initials: "SH",
        name: "Sarah Hughes",
        role: "Recruiter",
      },
    ]);
    expect(mapped.timeline?.map((item) => item.title)).toEqual(["Technical screen"]);
    expect(mapped.processingStatusLabel).toBe("Completed");
    expect(mapped.processingLog?.map((item) => item.title)).toEqual(["Scraping started"]);
    expect(mapped.interviewNotes).toBe("Ask about the product roadmap.");
    expect(mapped.aiMatch?.score).toBe(82);
    expect(mapped.aiMatch?.keywords).toContainEqual({ keyword: "React", match: true });
    expect(mapped.aiMatch?.keywords).toContainEqual({ keyword: "Node.js", match: false });
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
  });

  it("maps profile data without requiring mock-only fields", () => {
    const profile: ApiProfile = {
      certifications: [],
      createdAt: "2026-06-01T00:00:00.000Z",
      education: [],
      email: "person@example.com",
      experience: [
        {
          achievements: ["Built product UI"],
          company: "Acme",
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

  it("maps every profile experience description and achievement into AI comparisons", () => {
    const application = createApplicationDetail();
    const profile = createProfile();
    application.matchAnalysis = {
      ...application.matchAnalysis,
      recommendedAchievements: [
        "Enhanced role description.",
        "Enhanced first achievement.",
        "Enhanced second achievement.",
      ],
    };

    const mapped = mapApiJobApplicationToUi(application, profile);

    expect(mapped.aiMatch?.experienceOptimizations).toHaveLength(2);
    expect(mapped.aiMatch?.experienceOptimizations?.[0]).toEqual({
      title: "Frontend Engineer",
      company: "Acme",
      items: [
        {
          actual: "Built product experiences for SaaS teams.",
          enhanced: "Enhanced role description.",
          kind: "description",
        },
        {
          actual: "Built product UI.",
          enhanced: "Enhanced first achievement.",
          kind: "achievement",
        },
        {
          actual: "Improved accessibility.",
          enhanced: "Enhanced second achievement.",
          kind: "achievement",
        },
      ],
    });
    expect(mapped.aiMatch?.experienceOptimizations?.[1]).toEqual({
      title: "UI Engineer",
      company: "Beta",
      items: [
        {
          actual: "Delivered dashboards.",
          enhanced: undefined,
          kind: "achievement",
        },
      ],
    });
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
    id: "job-1",
    interviews: [
      {
        createdAt: "2026-06-02T00:00:00.000Z",
        id: "interview-1",
        jobApplicationId: "job-1",
        scheduledAt: "2026-06-03T13:30:00.000Z",
        status: "upcoming",
        title: "Technical screen",
        type: "Video",
        updatedAt: "2026-06-02T00:00:00.000Z",
      },
    ],
    matchAnalysis: {
      customizedSummary: "Frontend engineer focused on React.",
      interviewTips: ["Prepare React examples."],
      matchScore: 82,
      missingSkills: ["Node.js"],
      recommendedAchievements: ["Built accessible UI with React."],
      strongSkills: ["React"],
    },
    profileId: "profile-1",
    scrapeBundle: {
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
      metadata: { interviewNotes: "Ask about the product roadmap." },
      priority: "high",
      roleTitle: "Frontend Engineer",
      tags: ["Remote"],
    },
    updatedAt: "2026-06-02T00:00:00.000Z",
  };
}

function createProfile(): ApiProfile {
  return {
    certifications: [],
    createdAt: "2026-06-01T00:00:00.000Z",
    education: [],
    email: "person@example.com",
    experience: [
      {
        achievements: ["Built product UI.", "Improved accessibility."],
        company: "Acme",
        description: "Built product experiences for SaaS teams.",
        startDate: "2024",
        title: "Frontend Engineer",
      },
      {
        achievements: ["Delivered dashboards."],
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
