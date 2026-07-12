import { describe, expect, it } from "vitest";
import {
  claimScrapeJobSchema,
  createJobApplicationContactSchema,
  createJobApplicationFollowUpSchema,
  createJobApplicationSchema,
  listJobApplicationsQuerySchema,
  updateJobApplicationContactSchema,
  updateJobApplicationFollowUpSchema,
  updateJobApplicationSchema,
  scrapeBundleSchema,
} from "./job-application.schema.js";

describe("job application schemas", () => {
  it("accepts LinkedIn URL submissions with tracker defaults", () => {
    const result = createJobApplicationSchema.parse({
      profileId: "profile-1",
      sourceUrl: "https://www.linkedin.com/jobs/view/123",
    });

    expect(result.applicationStatus).toBe("saved");
    expect(result.priority).toBeUndefined();
    expect(result.tags).toEqual([]);
    expect(result.metadata).toEqual({});
  });

  it("accepts desktop scrape claims without a profile id", () => {
    const result = claimScrapeJobSchema.parse({
      claimedBy: "desktop-installation:runtime",
    });

    expect(result).toEqual({ claimedBy: "desktop-installation:runtime" });
  });

  it("parses paginated list defaults and grouped processing statuses", () => {
    expect(
      listJobApplicationsQuerySchema.parse({
        profileId: "profile-1",
        processingStatuses: "queued,scraping,analyzing",
        sortBy: "matchScore",
      }),
    ).toMatchObject({
      page: 1,
      pageSize: 20,
      processingStatuses: ["queued", "scraping", "analyzing"],
      sortBy: "matchScore",
    });
  });

  it("rejects invalid list page boundaries and processing statuses", () => {
    expect(
      listJobApplicationsQuerySchema.safeParse({ profileId: "profile-1", page: 0 }).success,
    ).toBe(false);
    expect(
      listJobApplicationsQuerySchema.safeParse({ profileId: "profile-1", pageSize: 101 }).success,
    ).toBe(false);
    expect(
      listJobApplicationsQuerySchema.safeParse({
        profileId: "profile-1",
        processingStatuses: "queued,unknown",
      }).success,
    ).toBe(false);
  });

  it("requires company and role for manual submissions", () => {
    const result = createJobApplicationSchema.safeParse({
      profileId: "profile-1",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual([
      "companyName",
      "roleTitle",
    ]);
  });

  it("accepts tracker updates", () => {
    const result = updateJobApplicationSchema.parse({
      applicationStatus: "interview",
      priority: "high",
      tags: ["Remote", "Dream Job"],
    });

    expect(result.applicationStatus).toBe("interview");
  });

  it("accepts ghosted tracker status", () => {
    const result = updateJobApplicationSchema.parse({ applicationStatus: "ghosted" });

    expect(result.applicationStatus).toBe("ghosted");
  });

  it("accepts setting and clearing interest priority", () => {
    expect(updateJobApplicationSchema.parse({ priority: "high" }).priority).toBe("high");
    expect(updateJobApplicationSchema.parse({ priority: null }).priority).toBeNull();
  });

  it("accepts setting and clearing work style", () => {
    expect(updateJobApplicationSchema.parse({ workStyle: "remote" }).workStyle).toBe("remote");
    expect(updateJobApplicationSchema.parse({ workStyle: "hybrid" }).workStyle).toBe("hybrid");
    expect(updateJobApplicationSchema.parse({ workStyle: "on_site" }).workStyle).toBe("on_site");
    expect(updateJobApplicationSchema.parse({ workStyle: null }).workStyle).toBeNull();
    expect(updateJobApplicationSchema.safeParse({ workStyle: "office" }).success).toBe(false);
  });

  it("accepts salary ranges, one-sided salaries, and clearing salary details", () => {
    expect(
      updateJobApplicationSchema.parse({
        salaryMinAmount: 90_000,
        salaryMaxAmount: 120_000,
        salaryCurrency: "EUR",
        salaryPeriod: "yearly",
        salaryType: "gross",
      }),
    ).toMatchObject({ salaryMinAmount: 90_000, salaryMaxAmount: 120_000 });
    expect(
      updateJobApplicationSchema.safeParse({
        salaryMinAmount: null,
        salaryMaxAmount: 50,
        salaryCurrency: "USD",
        salaryPeriod: "hourly",
        salaryType: "net",
      }).success,
    ).toBe(true);
    expect(
      updateJobApplicationSchema.safeParse({
        salaryMinAmount: null,
        salaryMaxAmount: null,
        salaryCurrency: null,
        salaryPeriod: null,
        salaryType: null,
      }).success,
    ).toBe(true);
  });

  it.each([
    [{ salaryMinAmount: -1, salaryCurrency: "USD", salaryPeriod: "yearly", salaryType: "gross" }],
    [
      {
        salaryMinAmount: 100,
        salaryMaxAmount: 90,
        salaryCurrency: "USD",
        salaryPeriod: "yearly",
        salaryType: "gross",
      },
    ],
    [{ salaryMinAmount: 100, salaryPeriod: "yearly", salaryType: "gross" }],
    [{ salaryMinAmount: 100, salaryCurrency: "USD", salaryType: "gross" }],
    [{ salaryMinAmount: 100, salaryCurrency: "ZZZ", salaryPeriod: "yearly", salaryType: "gross" }],
    [{ salaryMinAmount: 100, salaryCurrency: "USD", salaryPeriod: "yearly" }],
  ])("rejects invalid salary details: %o", (input) => {
    expect(updateJobApplicationSchema.safeParse(input).success).toBe(false);
  });

  it("accepts contact payloads for key contacts", () => {
    const created = createJobApplicationContactSchema.parse({
      name: "Sarah Hughes",
      role: "Recruitment Lead",
      email: "sarah@example.com",
      linkedInUrl: "https://www.linkedin.com/in/sarah-hughes",
      notes: "Main recruiter for the process",
    });
    const updated = updateJobApplicationContactSchema.parse({
      role: null,
      phone: "+1 555 0101",
    });

    expect(created.name).toBe("Sarah Hughes");
    expect(updated.role).toBeNull();
  });

  it("accepts sanitized scraped job description HTML as optional display data", () => {
    const result = scrapeBundleSchema.parse({
      job: {
        title: "Frontend Engineer",
        companyName: "Acme",
        description: "Build TypeScript services.",
        descriptionHtml: "<p>Build <strong>TypeScript</strong> services.</p>",
        requirements: [],
        raw: {},
      },
    });

    expect(result.job.descriptionHtml).toBe("<p>Build <strong>TypeScript</strong> services.</p>");
  });

  it("accepts follow-up payloads with title, description, and scheduled date", () => {
    const created = createJobApplicationFollowUpSchema.parse({
      title: "Send thank-you email",
      description: "Follow up after the phone screen.",
      scheduledAt: "2026-07-15T09:00:00.000Z",
    });
    const updated = updateJobApplicationFollowUpSchema.parse({
      title: "Check on application status",
      description: null,
      scheduledAt: "2026-07-20T14:00:00.000Z",
    });

    expect(created.title).toBe("Send thank-you email");
    expect(created.scheduledAt).toEqual(new Date("2026-07-15T09:00:00.000Z"));
    expect(updated.description).toBeNull();
    expect(updated.scheduledAt).toEqual(new Date("2026-07-20T14:00:00.000Z"));
  });
});
