import { describe, expect, it, vi } from "vitest";
import {
  createJobApplicationRepository,
  createProfiles,
  createTestJobApplication,
} from "./job-application-test-helpers.js";
import { GetJobApplicationAnalyticsUseCase } from "./get-job-application-analytics.use-case.js";

describe("GetJobApplicationAnalyticsUseCase", () => {
  it("calculates tracker analytics for an owned profile", async () => {
    const repository = createJobApplicationRepository({
      listByProfileId: vi.fn(async () => [
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
      ]),
    });

    const result = await new GetJobApplicationAnalyticsUseCase(
      repository,
      createProfiles(),
    ).execute("profile-1", "user-1");

    expect(result.interviewConversionRate).toBe(1);
    expect(result.averageTimeToResponseDays).toBe(3);
  });
});
