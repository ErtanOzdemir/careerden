import { describe, expect, it, vi } from "vitest";
import type { UserProfileAccountRepository } from "@link2cv/domain";
import {
  InMemoryJobApplicationRepository,
  InMemoryUserProfileRepository,
} from "@link2cv/infrastructure";
import { SubmitJobApplicationUseCase } from "./submit-job-application.use-case.js";
import { JobApplicationChangeNotifier } from "./job-application-change.notifier.js";

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
    const publish = vi.fn();

    const jobApplication = await new SubmitJobApplicationUseCase(
      jobApplications,
      withAccountOwnership(profiles),
      new JobApplicationChangeNotifier({ publish }),
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
    expect(publish).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "application.changed",
        applicationId: jobApplication.id,
        profileId: profile.id,
      }),
    );
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
    const publish = vi.fn();

    const jobApplication = await new SubmitJobApplicationUseCase(
      jobApplications,
      withAccountOwnership(profiles),
      new JobApplicationChangeNotifier({ publish }),
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
    expect(publish).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "application.changed",
        applicationId: jobApplication.id,
        profileId: profile.id,
      }),
    );
  });

  it("does not publish when profile access is denied before creation", async () => {
    const profiles = new InMemoryUserProfileRepository();
    const jobApplications = new InMemoryJobApplicationRepository();
    const profile = await profiles.create({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      skills: [],
      experience: [],
    });
    const publish = vi.fn();

    await expect(
      new SubmitJobApplicationUseCase(
        jobApplications,
        Object.assign(profiles, {
          findByUserId: vi.fn(),
          createForUserId: vi.fn(),
          findUserIdByProfileId: vi.fn(async () => "another-user"),
        }),
        new JobApplicationChangeNotifier({ publish }),
      ).execute({ profileId: profile.id }, "user-1"),
    ).rejects.toThrow("Profile not found");

    expect(publish).not.toHaveBeenCalled();
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
