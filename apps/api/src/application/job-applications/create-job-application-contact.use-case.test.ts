import { describe, expect, it, vi } from "vitest";
import type { JobApplicationContact } from "@careerden/domain";
import { CreateJobApplicationContactUseCase } from "./create-job-application-contact.use-case.js";
import {
  createJobApplicationRepository,
  createProfiles,
  createTestJobApplication,
  createUnitOfWork,
} from "@careerden/application/testing";

describe("CreateJobApplicationContactUseCase", () => {
  it("creates a contact and publishes the settled application change", async () => {
    const job = createTestJobApplication();
    const now = new Date("2026-07-11T12:00:00.000Z");
    const contact = {
      id: "contact-1",
      jobApplicationId: job.id,
      name: "Grace Hopper",
      createdAt: now,
      updatedAt: now,
    } satisfies JobApplicationContact;
    const repository = createJobApplicationRepository({
      findById: vi.fn(async () => job),
      createContact: vi.fn(async () => contact),
    });
    const { unitOfWork, recordChanged } = createUnitOfWork(repository, createProfiles());

    await expect(
      new CreateJobApplicationContactUseCase(unitOfWork).execute(job.id, "user-1", {
        name: contact.name,
      }),
    ).resolves.toBe(contact);
    expect(recordChanged).toHaveBeenCalledOnce();
  });
});
