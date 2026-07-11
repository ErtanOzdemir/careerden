import { describe, expect, it, vi } from "vitest";
import type { UserProfileAccountRepository } from "@link2cv/domain";
import {
  InMemoryJobApplicationRepository,
  InMemoryUserProfileRepository,
} from "@link2cv/infrastructure";
import { SubmitJobApplicationUseCase } from "./submit-job-application.use-case.js";

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

    const jobApplication = await new SubmitJobApplicationUseCase(
      jobApplications,
      withAccountOwnership(profiles),
    ).execute(
      {
        profileId: profile.id,
        sourceUrl: "https://www.linkedin.com/jobs/view/123",
      },
      "user-1",
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

    const jobApplication = await new SubmitJobApplicationUseCase(
      jobApplications,
      withAccountOwnership(profiles),
    ).execute(
      {
        profileId: profile.id,
        companyName: "Example Inc",
        roleTitle: "Backend Engineer",
        priority: "high",
        tags: ["Remote"],
      },
      "user-1",
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

function withAccountOwnership(
  profiles: InMemoryUserProfileRepository,
): UserProfileAccountRepository {
  return Object.assign(profiles, {
    findByUserId: vi.fn(),
    createForUserId: vi.fn(),
    findUserIdByProfileId: vi.fn(async () => "user-1"),
  });
}
