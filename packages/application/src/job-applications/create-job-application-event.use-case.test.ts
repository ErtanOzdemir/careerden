import { describe, expect, it, vi } from "vitest";
import type { JobApplicationEvent } from "@link2cv/domain";
import { CreateJobApplicationEventUseCase } from "./create-job-application-event.use-case.js";
import {
  createJobApplicationRepository,
  createProfiles,
  createTestJobApplication,
  createUnitOfWork,
} from "./job-application-test-helpers.js";

describe("CreateJobApplicationEventUseCase", () => {
  it("creates an event and publishes the settled application change", async () => {
    const job = createTestJobApplication();
    const event = {
      id: "event-1",
      jobApplicationId: job.id,
      type: "note",
      title: "Recruiter replied",
      occurredAt: new Date("2026-07-11T12:00:00.000Z"),
      metadata: {},
      createdAt: new Date("2026-07-11T12:00:00.000Z"),
    } satisfies JobApplicationEvent;
    const repository = createJobApplicationRepository({
      findById: vi.fn(async () => job),
      addEvent: vi.fn(async () => event),
    });
    const { unitOfWork, recordChanged } = createUnitOfWork(repository, createProfiles());

    await expect(
      new CreateJobApplicationEventUseCase(unitOfWork).execute(job.id, "user-1", {
        type: "note",
        title: "Recruiter replied",
      }),
    ).resolves.toBe(event);
    expect(recordChanged).toHaveBeenCalledOnce();
  });
});
