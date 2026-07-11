import { describe, expect, it, vi } from "vitest";
import type {
  AddOutboxEventInput,
  OutboxEvent,
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
    const outbox: AddOutboxEventInput[] = [];

    const jobApplication = await new SubmitJobApplicationUseCase(
      createUnitOfWork(jobApplications, withAccountOwnership(profiles), outbox),
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
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toEqual(
      expect.objectContaining({
        type: "job-application.change",
        aggregateId: jobApplication.id,
        payload: expect.objectContaining({
          type: "application.changed",
          applicationId: jobApplication.id,
          profileId: profile.id,
        }),
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
    const outbox: AddOutboxEventInput[] = [];

    const jobApplication = await new SubmitJobApplicationUseCase(
      createUnitOfWork(jobApplications, withAccountOwnership(profiles), outbox),
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
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toEqual(
      expect.objectContaining({
        type: "job-application.change",
        payload: expect.objectContaining({
          applicationId: jobApplication.id,
          profileId: profile.id,
        }),
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
    const outbox: AddOutboxEventInput[] = [];

    await expect(
      new SubmitJobApplicationUseCase(
        createUnitOfWork(
          jobApplications,
          Object.assign(profiles, {
            findByUserId: vi.fn(),
            createForUserId: vi.fn(),
            findUserIdByProfileId: vi.fn(async () => "another-user"),
          }),
          outbox,
        ),
      ).execute({ profileId: profile.id }, "user-1"),
    ).rejects.toThrow("Profile not found");

    expect(outbox).toHaveLength(0);
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
  events: AddOutboxEventInput[],
): PersistenceUnitOfWork {
  return {
    execute: async (work) =>
      work({
        jobApplications,
        profiles,
        notifications: {} as never,
        followUpReminders: {} as never,
        outbox: {
          add: vi.fn(async (input): Promise<OutboxEvent> => {
            events.push(input);
            return { ...input, id: `outbox-${events.length}`, attemptCount: 0 };
          }),
        },
      }),
  };
}
