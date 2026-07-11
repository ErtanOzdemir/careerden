import { describe, expect, it, vi } from "vitest";
import type { JobApplicationContact } from "@link2cv/domain";
import { DeleteJobApplicationContactUseCase } from "./delete-job-application-contact.use-case.js";
import {
  createJobApplicationChanges,
  createJobApplicationRepository,
  createProfiles,
  createTestJobApplication,
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
    const { changes, publish } = createJobApplicationChanges();

    await new DeleteJobApplicationContactUseCase(repository, createProfiles(), changes).execute(
      job.id,
      contact.id,
      "user-1",
    );

    expect(repository.deleteContact).toHaveBeenCalledWith(contact.id);
    expect(publish).toHaveBeenCalledOnce();
  });
});
