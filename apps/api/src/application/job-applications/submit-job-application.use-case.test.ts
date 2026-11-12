import { describe, expect, it, vi } from "vitest";
import type {
  JobApplicationChange,
  PersistenceUnitOfWork,
  UserProfileAccountRepository,
} from "@careerden/domain";
import {
  InMemoryJobApplicationRepository,
  InMemoryUserProfileRepository,
} from "@careerden/infrastructure";
import { SubmitJobApplicationUseCase } from "./submit-job-application.use-case.js";

describe("SubmitJobApplicationUseCase", () => {
  it("creates source URL tracker applications without enqueueing background work", async () => {
    const profiles = new InMemoryUserProfileRepository();
    const jobApplications = new InMemoryJobApplicationRepository();
    const profile = await profiles.create({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      skillGroups: [{ name: "", skills: ["TypeScript"] }],
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

  it("rejects submissions without a LinkedIn source URL", async () => {
    const profiles = new InMemoryUserProfileRepository();
    const jobApplications = new InMemoryJobApplicationRepository();
    const profile = await profiles.create({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      skillGroups: [{ name: "", skills: ["TypeScript"] }],
      experience: [],
    });
    const changes: JobApplicationChange[] = [];

    await expect(
      new SubmitJobApplicationUseCase(
        createUnitOfWork(jobApplications, withAccountOwnership(profiles), changes),
      ).execute({ profileId: profile.id }, "user-1"),
    ).rejects.toThrow("A LinkedIn source URL is required");

    expect(changes).toHaveLength(0);
  });

  it("does not publish when profile access is denied before creation", async () => {
    const profiles = new InMemoryUserProfileRepository();
    const jobApplications = new InMemoryJobApplicationRepository();
    const profile = await profiles.create({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      skillGroups: [],
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
      ).execute(
        {
          profileId: profile.id,
          sourceUrl: "https://www.linkedin.com/jobs/view/123",
        },
        "user-1",
      ),
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
        billingSubscriptions: {} as never,
        credits: {} as never,
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
        notificationChanges: {} as never,
        followUpReminders: {} as never,
        outbox: {} as never,
      }),
  };
}
