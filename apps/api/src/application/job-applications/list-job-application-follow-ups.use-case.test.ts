import { describe, expect, it, vi } from "vitest";
import type { JobApplicationFollowUp } from "@careerden/domain";
import { ListJobApplicationFollowUpsUseCase } from "./list-job-application-follow-ups.use-case.js";
import {
  createJobApplicationRepository,
  createProfiles,
  createTestJobApplication,
} from "@careerden/application/testing";

describe("ListJobApplicationFollowUpsUseCase", () => {
  it("lists the follow-ups of an owned job application", async () => {
    const job = createTestJobApplication();
    const items = [{ id: "item-1", jobApplicationId: job.id } as JobApplicationFollowUp];
    const repository = createJobApplicationRepository({
      findById: vi.fn(async () => job),
      listFollowUps: vi.fn(async () => items),
    });

    await expect(
      new ListJobApplicationFollowUpsUseCase(repository, createProfiles()).execute(
        job.id,
        "user-1",
      ),
    ).resolves.toBe(items);
    expect(repository.listFollowUps).toHaveBeenCalledWith(job.id);
  });

  it("hides the follow-ups of another user's job application", async () => {
    const repository = createJobApplicationRepository({
      findById: vi.fn(async () => createTestJobApplication()),
    });

    await expect(
      new ListJobApplicationFollowUpsUseCase(repository, createProfiles()).execute(
        "job-1",
        "user-2",
      ),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(repository.listFollowUps).not.toHaveBeenCalled();
  });
});
