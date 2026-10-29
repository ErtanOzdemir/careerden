import { describe, expect, it, vi } from "vitest";
import {
  createJobApplicationRepository,
  createProfiles,
  createStorage,
  createTestJobApplication,
} from "@careerden/application/testing";
import type { ApplicationStatus } from "@careerden/domain";
import {
  analyticsCompaniesPerStatusLimit,
  calculateJobApplicationAnalytics,
  GetJobApplicationAnalyticsUseCase,
} from "./get-job-application-analytics.use-case.js";

describe("GetJobApplicationAnalyticsUseCase", () => {
  it("calculates tracker analytics for an owned profile", async () => {
    const repository = createJobApplicationRepository({
      listByProfileId: vi.fn(async () => ({
        items: [
          createTestJobApplication({
            tracking: {
              applicationStatus: "interview",
              priority: "medium",
              tags: [],
              metadata: {},
              dateApplied: "2026-06-01",
              lastResponseAt: new Date("2026-06-04T00:00:00.000Z"),
            },
          }),
        ],
        totalItems: 1,
      })),
    });

    const result = await new GetJobApplicationAnalyticsUseCase(
      repository,
      createProfiles(),
    ).execute("profile-1", "user-1");

    expect(result.interviewConversionRate).toBe(1);
    expect(result.averageTimeToResponseDays).toBe(3);
  });

  it("keeps ghosted applications separate from rejection metrics", () => {
    const result = calculateJobApplicationAnalytics([
      createTestJobApplication({
        tracking: { ...createTestJobApplication().tracking, applicationStatus: "ghosted" },
      }),
    ]);

    expect(result.byStatus.ghosted).toBe(1);
    expect(result.rejections).toBe(0);
    expect(result.responseRate).toBe(0);
  });

  it("lists the most recently updated companies per status with their logos", async () => {
    const job = (id: string, status: ApplicationStatus, updatedAt: string, companyName?: string) =>
      createTestJobApplication({
        id,
        updatedAt: new Date(updatedAt),
        tracking: {
          applicationStatus: status,
          priority: "medium",
          tags: [],
          metadata: {},
          ...(companyName ? { companyName } : {}),
        },
      });
    const repository = createJobApplicationRepository({
      listByProfileId: vi.fn(async () => ({
        items: [
          job("old", "applied", "2026-10-01T00:00:00.000Z", "Acme"),
          job("new", "applied", "2026-10-20T00:00:00.000Z", "Globex"),
          job("unnamed", "interview", "2026-10-10T00:00:00.000Z"),
        ],
        totalItems: 3,
      })),
      getCompanyLogoFileId: vi.fn(async (id: string) => (id === "new" ? "logos/new.png" : null)),
    });
    const storage = createStorage({
      getSignedUrl: vi.fn(async (fileId: string) => `/api/files/${fileId}?signature=s`),
    });

    const result = await new GetJobApplicationAnalyticsUseCase(
      repository,
      createProfiles(),
      storage,
    ).execute("profile-1", "user-1");

    expect(result.companiesByStatus).toEqual({
      applied: [
        {
          jobApplicationId: "new",
          companyName: "Globex",
          companyLogoUrl: "/api/files/logos/new.png?signature=s",
        },
        { jobApplicationId: "old", companyName: "Acme" },
      ],
      interview: [{ jobApplicationId: "unnamed" }],
    });
  });

  it("caps the companies listed for one status", async () => {
    const items = Array.from({ length: analyticsCompaniesPerStatusLimit + 5 }, (_, index) =>
      createTestJobApplication({ id: `job-${index}` }),
    );
    const repository = createJobApplicationRepository({
      listByProfileId: vi.fn(async () => ({ items, totalItems: items.length })),
    });

    const result = await new GetJobApplicationAnalyticsUseCase(
      repository,
      createProfiles(),
    ).execute("profile-1", "user-1");
    const [companies] = Object.values(result.companiesByStatus);

    expect(result.total).toBe(analyticsCompaniesPerStatusLimit + 5);
    expect(companies).toHaveLength(analyticsCompaniesPerStatusLimit);
  });
});
