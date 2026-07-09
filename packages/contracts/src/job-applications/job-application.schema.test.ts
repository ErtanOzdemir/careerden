import { describe, expect, it } from "vitest";
import {
  claimScrapeJobSchema,
  createJobApplicationContactSchema,
  createJobApplicationFollowUpSchema,
  createJobApplicationSchema,
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

    expect(result.applicationStatus).toBe("applied");
    expect(result.priority).toBe("medium");
    expect(result.tags).toEqual([]);
    expect(result.metadata).toEqual({});
  });

  it("accepts desktop scrape claims without a profile id", () => {
    const result = claimScrapeJobSchema.parse({
      claimedBy: "desktop-installation:runtime",
    });

    expect(result).toEqual({ claimedBy: "desktop-installation:runtime" });
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
