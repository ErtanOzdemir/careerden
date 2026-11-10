import { describe, expect, it, vi } from "vitest";
import type { JobApplicationEvent } from "@careerden/domain";
import { ListJobApplicationEventsUseCase } from "./list-job-application-events.use-case.js";
import {
  createJobApplicationRepository,
  createProfiles,
  createTestJobApplication,
} from "@careerden/application/testing";

describe("ListJobApplicationEventsUseCase", () => {
  it("lists the events of an owned job application", async () => {
    const job = createTestJobApplication();
    const items = [{ id: "item-1", jobApplicationId: job.id } as JobApplicationEvent];
    const repository = createJobApplicationRepository({
      findById: vi.fn(async () => job),
      listEvents: vi.fn(async () => items),
    });

    await expect(
      new ListJobApplicationEventsUseCase(repository, createProfiles()).execute(job.id, "user-1"),
    ).resolves.toBe(items);
    expect(repository.listEvents).toHaveBeenCalledWith(job.id);
  });

  it("hides the events of another user's job application", async () => {
    const repository = createJobApplicationRepository({
      findById: vi.fn(async () => createTestJobApplication()),
    });

    await expect(
      new ListJobApplicationEventsUseCase(repository, createProfiles()).execute("job-1", "user-2"),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(repository.listEvents).not.toHaveBeenCalled();
  });
});
