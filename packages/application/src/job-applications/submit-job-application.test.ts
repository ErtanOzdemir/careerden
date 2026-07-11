import { describe, expect, it } from "vitest";
import {
  InMemoryJobApplicationRepository,
  InMemoryUserProfileRepository,
} from "@link2cv/infrastructure";
import { SubmitJobApplicationUseCase } from "./submit-job-application.js";

describe("SubmitJobApplicationUseCase", () => {
  it("creates source URL tracker applications without enqueueing background work", async () => {
    const profiles = new InMemoryUserProfileRepository();
    const jobApplications = new InMemoryJobApplicationRepository();
    const profile = await profiles.create({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      skills: ["TypeScript"],
      experience: [],
    });

    const jobApplication = await new SubmitJobApplicationUseCase(jobApplications, profiles).execute(
      {
        profileId: profile.id,
        sourceUrl: "https://www.linkedin.com/jobs/view/123",
      },
    );

    expect(jobApplication.status).toBe("queued");
    expect(jobApplication.sourceUrl).toBe("https://www.linkedin.com/jobs/view/123");
    expect(jobApplication.tracking.jobUrl).toBe("https://www.linkedin.com/jobs/view/123");
  });

  it("creates manual applications with a manual scrape bundle", async () => {
    const profiles = new InMemoryUserProfileRepository();
    const jobApplications = new InMemoryJobApplicationRepository();
    const profile = await profiles.create({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      skills: ["TypeScript"],
      experience: [],
    });

    const jobApplication = await new SubmitJobApplicationUseCase(jobApplications, profiles).execute(
      {
        profileId: profile.id,
        companyName: "Example Inc",
        roleTitle: "Backend Engineer",
        priority: "high",
        tags: ["Remote"],
      },
    );

    const scrape = await jobApplications.getScrapeBundle(jobApplication.id);

    expect(jobApplication.status).toBe("scraped");
    expect(jobApplication.sourceUrl).toBeUndefined();
    expect(jobApplication.tracking.companyName).toBe("Example Inc");
    expect(jobApplication.tracking.roleTitle).toBe("Backend Engineer");
    expect(jobApplication.tracking.priority).toBe("high");
    expect(scrape?.job).toMatchObject({
      title: "Backend Engineer",
      companyName: "Example Inc",
      description: "Manual job entry for Backend Engineer at Example Inc.",
      raw: {
        adapter: "manual-job",
        strategy: "manual",
        source: "user-created-job-application",
      },
    });
  });
});
