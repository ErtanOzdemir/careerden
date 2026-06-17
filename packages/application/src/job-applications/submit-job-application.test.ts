import { describe, expect, it } from "vitest";
import type { JobApplicationQueue } from "@link2cv/domain";
import {
  InMemoryJobApplicationRepository,
  InMemoryUserProfileRepository,
} from "@link2cv/infrastructure";
import { SubmitJobApplicationUseCase } from "./submit-job-application.js";

describe("SubmitJobApplicationUseCase", () => {
  it("marks the application failed when it cannot enqueue background work", async () => {
    const profiles = new InMemoryUserProfileRepository();
    const jobApplications = new InMemoryJobApplicationRepository();
    const profile = await profiles.create({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      skills: ["TypeScript"],
      experience: [],
    });
    const queue: JobApplicationQueue = {
      async enqueue() {
        throw new Error("REDIS_URL is required");
      },
    };

    await expect(
      new SubmitJobApplicationUseCase(jobApplications, profiles, queue).execute({
        profileId: profile.id,
        sourceUrl: "https://www.linkedin.com/jobs/view/123",
      }),
    ).rejects.toThrow("REDIS_URL is required");

    const [jobApplication] = await jobApplications.listByProfileId(profile.id);

    expect(jobApplication?.status).toBe("failed");
    expect(jobApplication?.failureReason).toBe("REDIS_URL is required");
  });

  it("creates manual tracker applications without enqueueing background work", async () => {
    const profiles = new InMemoryUserProfileRepository();
    const jobApplications = new InMemoryJobApplicationRepository();
    const profile = await profiles.create({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      skills: ["TypeScript"],
      experience: [],
    });
    const queue: JobApplicationQueue = {
      async enqueue() {
        throw new Error("Manual applications should not be queued");
      },
    };

    const jobApplication = await new SubmitJobApplicationUseCase(
      jobApplications,
      profiles,
      queue,
    ).execute({
      profileId: profile.id,
      companyName: "Example Inc",
      roleTitle: "Backend Engineer",
      priority: "high",
      tags: ["Remote"],
    });

    expect(jobApplication.status).toBe("completed");
    expect(jobApplication.sourceUrl).toBeUndefined();
    expect(jobApplication.tracking.companyName).toBe("Example Inc");
    expect(jobApplication.tracking.roleTitle).toBe("Backend Engineer");
    expect(jobApplication.tracking.priority).toBe("high");
  });
});
