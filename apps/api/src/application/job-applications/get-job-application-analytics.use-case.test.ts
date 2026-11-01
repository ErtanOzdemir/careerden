import { describe, expect, it, vi } from "vitest";
import {
  createJobApplicationRepository,
  createProfiles,
  createStorage,
  createTestJobApplication,
} from "@careerden/application/testing";
import type { ApplicationStatus } from "@careerden/domain";
import {
  analyticsCompaniesPerFlowLimit,
  applicationPipelinePath,
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

  it("counts declined and rescinded offers as offers, not rejections", () => {
    const job = (applicationStatus: ApplicationStatus) =>
      createTestJobApplication({
        tracking: { ...createTestJobApplication().tracking, applicationStatus },
      });

    const result = calculateJobApplicationAnalytics([
      job("offer"),
      job("declined"),
      job("rescinded"),
      job("applied"),
    ]);

    expect(result.offers).toBe(3);
    expect(result.rejections).toBe(0);
    expect(result.interviewConversionRate).toBe(0.75);
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

  it("follows each application through the stages it reached, ending at its current one", async () => {
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
    const statusChange = (jobApplicationId: string, from: string, to: string) => ({
      id: `${jobApplicationId}-${to}`,
      jobApplicationId,
      type: "status_changed" as const,
      title: `Status changed to ${to}`,
      occurredAt: new Date("2026-10-01T00:00:00.000Z"),
      createdAt: new Date("2026-10-01T00:00:00.000Z"),
      metadata: { from, to },
    });
    const repository = createJobApplicationRepository({
      listByProfileId: vi.fn(async () => ({
        items: [
          job("rejected", "rejected", "2026-10-01T00:00:00.000Z", "Acme"),
          job("offer", "offer", "2026-10-20T00:00:00.000Z", "Globex"),
          job("saved", "saved", "2026-10-10T00:00:00.000Z"),
        ],
        totalItems: 3,
      })),
      listStatusChanges: vi.fn(async () => [
        statusChange("rejected", "saved", "applied"),
        statusChange("rejected", "applied", "interview"),
        statusChange("rejected", "interview", "rejected"),
        statusChange("offer", "applied", "phone_screen"),
        statusChange("offer", "phone_screen", "offer"),
      ]),
      getCompanyLogoFileId: vi.fn(async (id: string) => (id === "offer" ? "logos/g.png" : null)),
    });
    const storage = createStorage({
      getSignedUrl: vi.fn(async (fileId: string) => `/api/files/${fileId}?signature=s`),
    });

    const result = await new GetJobApplicationAnalyticsUseCase(
      repository,
      createProfiles(),
      storage,
    ).execute("profile-1", "user-1");

    const globex = {
      jobApplicationId: "offer",
      companyName: "Globex",
      companyLogoUrl: "/api/files/logos/g.png?signature=s",
    };
    const acme = { jobApplicationId: "rejected", companyName: "Acme" };
    expect(result.pipeline).toEqual([
      { source: "applications", target: "applied", count: 2, companies: [] },
      { source: "applied", target: "phone_screen", count: 1, companies: [] },
      { source: "phone_screen", target: "offer", count: 1, companies: [globex] },
      {
        source: "applications",
        target: "saved",
        count: 1,
        companies: [{ jobApplicationId: "saved" }],
      },
      { source: "applied", target: "interview", count: 1, companies: [] },
      { source: "interview", target: "rejected", count: 1, companies: [acme] },
    ]);
    expect(repository.getCompanyLogoFileId).toHaveBeenCalledTimes(3);
  });

  it("caps the companies listed for one flow", async () => {
    const items = Array.from({ length: analyticsCompaniesPerFlowLimit + 5 }, (_, index) =>
      createTestJobApplication({ id: `job-${index}` }),
    );
    const repository = createJobApplicationRepository({
      listByProfileId: vi.fn(async () => ({ items, totalItems: items.length })),
    });

    const result = await new GetJobApplicationAnalyticsUseCase(
      repository,
      createProfiles(),
    ).execute("profile-1", "user-1");
    const [flow] = result.pipeline;

    expect(result.total).toBe(analyticsCompaniesPerFlowLimit + 5);
    expect(flow?.count).toBe(analyticsCompaniesPerFlowLimit + 5);
    expect(flow?.companies).toHaveLength(analyticsCompaniesPerFlowLimit);
  });
});

describe("applicationPipelinePath", () => {
  it.each([
    ["saved", [], ["saved"]],
    ["applied", ["saved", "applied"], ["applied"]],
    ["ghosted", [], ["applied", "ghosted"]],
    ["rejected", ["applied", "interview", "offer"], ["applied", "interview", "offer", "rejected"]],
    ["interview", ["applied", "ghosted", "interview"], ["applied", "interview"]],
    ["offer", ["saved"], ["applied", "offer"]],
    // Moving back is a real step of the process: stages reached before still count.
    ["applied", ["applied", "interview", "applied"], ["applied", "interview"]],
    [
      "phone_screen",
      ["applied", "interview", "phone_screen"],
      ["applied", "phone_screen", "interview"],
    ],
    ["saved", ["saved", "applied", "saved"], ["applied"]],
    ["ghosted", ["applied", "offer", "applied"], ["applied", "offer", "ghosted"]],
    ["declined", ["applied", "interview", "offer"], ["applied", "interview", "offer", "declined"]],
    ["rescinded", ["applied", "offer"], ["applied", "offer", "rescinded"]],
    ["declined", [], ["applied", "offer", "declined"]],
  ] satisfies Array<[ApplicationStatus, ApplicationStatus[], ApplicationStatus[]]>)(
    "maps %s with history %j to %j",
    (current, history, expected) => {
      expect(applicationPipelinePath(current, history)).toEqual(expected);
    },
  );
});
