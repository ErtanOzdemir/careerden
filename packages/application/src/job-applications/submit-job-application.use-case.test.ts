import { describe, expect, it, vi } from "vitest";
import type {
  JobApplicationChange,
  PersistenceUnitOfWork,
  UserProfileAccountRepository,
} from "@link2cv/domain";
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
    const changes: JobApplicationChange[] = [];

    const jobApplication = await new SubmitJobApplicationUseCase(
      createUnitOfWork(jobApplications, withAccountOwnership(profiles), changes),
    ).execute(
      {
        profileId: profile.id,
        sourceUrl: "https://www.linkedin.com/jobs/view/123",
        applicationPackPreferences: {
          language: "tr-TR",
          tone: "concise",
          cvTemplateId: "cv-template",
        },
      },
      "user-1",
    );

    expect(jobApplication.status).toBe("queued");
    expect(jobApplication.tracking.applicationStatus).toBe("saved");
    expect(jobApplication.sourceUrl).toBe("https://www.linkedin.com/jobs/view/123");
    expect(jobApplication.applicationPackPreferences).toEqual({
      language: "tr-TR",
      tone: "concise",
      cvTemplateId: "cv-template",
    });
    expect(jobApplication.tracking.jobUrl).toBe("https://www.linkedin.com/jobs/view/123");
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual(
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
    const changes: JobApplicationChange[] = [];

    const jobApplication = await new SubmitJobApplicationUseCase(
      createUnitOfWork(jobApplications, withAccountOwnership(profiles), changes),
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
    expect(jobApplication.tracking.applicationStatus).toBe("saved");
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
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual(
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
    const changes: JobApplicationChange[] = [];

    await expect(
      new SubmitJobApplicationUseCase(
        createUnitOfWork(
          jobApplications,
          Object.assign(profiles, {
            findByUserId: vi.fn(),
            createForUserId: vi.fn(),
            findUserIdByProfileId: vi.fn(async () => "another-user"),
          }),
          changes,
        ),
      ).execute({ profileId: profile.id }, "user-1"),
    ).rejects.toThrow("Profile not found");

    expect(changes).toHaveLength(0);
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

function createUnitOfWork(
  jobApplications: InMemoryJobApplicationRepository,
  profiles: UserProfileAccountRepository,
  changes: JobApplicationChange[],
): PersistenceUnitOfWork {
  return {
    execute: async (work) =>
      work({
        jobApplications,
        jobApplicationChanges: {
          changed: async (applicationId, profileId) => {
            changes.push({
              type: "application.changed",
              applicationId,
              profileId,
              occurredAt: new Date().toISOString(),
            });
          },
          deleted: vi.fn(),
        },
        profiles,
        notifications: {} as never,
        followUpReminders: {} as never,
        outbox: {} as never,
      }),
  };
}
