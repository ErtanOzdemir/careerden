import { describe, expect, it, vi } from "vitest";
import {
  createJobApplicationRepository,
  createProfiles,
  createTestJobApplication,
} from "./job-application-test-helpers.js";
import {
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
});
