import { describe, expect, it } from "vitest";
import {
  createJobApplicationContactSchema,
  createJobApplicationInterviewSchema,
  createJobApplicationSchema,
  updateJobApplicationContactSchema,
  updateJobApplicationInterviewSchema,
  updateJobApplicationSchema,
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
      nextFollowUpAt: "2026-06-20T09:00:00.000Z",
    });

    expect(result.applicationStatus).toBe("interview");
    expect(result.nextFollowUpAt).toEqual(new Date("2026-06-20T09:00:00.000Z"));
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

  it("accepts interview timeline payloads and defaults status to upcoming", () => {
    const created = createJobApplicationInterviewSchema.parse({
      title: "Technical Portfolio Review",
      type: "Technical",
      scheduledAt: "2026-06-24T12:00:00.000Z",
      prepNotes: "Review checkout flow redesign",
    });
    const updated = updateJobApplicationInterviewSchema.parse({
      status: "completed",
      notes: "Focused on design systems",
    });

    expect(created.status).toBe("upcoming");
    expect(created.scheduledAt).toEqual(new Date("2026-06-24T12:00:00.000Z"));
    expect(updated.status).toBe("completed");
  });
});
