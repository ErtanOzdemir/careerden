import { describe, expect, it, vi } from "vitest";
import type { JobApplicationContact } from "@link2cv/domain";
import { DeleteJobApplicationContactUseCase } from "./delete-job-application-contact.use-case.js";
import {
  createJobApplicationRepository,
  createProfiles,
  createTestJobApplication,
  createUnitOfWork,
} from "./job-application-test-helpers.js";

describe("DeleteJobApplicationContactUseCase", () => {
  it("deletes an owned contact and publishes the settled application change", async () => {
    const job = createTestJobApplication();
    const contact = { id: "contact-1", jobApplicationId: job.id } as JobApplicationContact;
    const repository = createJobApplicationRepository({
      findById: vi.fn(async () => job),
      findContactById: vi.fn(async () => contact),
      deleteContact: vi.fn(),
    });
    const { unitOfWork, recordChanged } = createUnitOfWork(repository, createProfiles());

    await new DeleteJobApplicationContactUseCase(unitOfWork).execute(job.id, contact.id, "user-1");

    expect(repository.deleteContact).toHaveBeenCalledWith(contact.id);
    expect(recordChanged).toHaveBeenCalledOnce();
  });
});
