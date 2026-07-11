import { describe, expect, it, vi } from "vitest";
import type { JobApplicationContact } from "@link2cv/domain";
import {
  createJobApplicationRepository,
  createJobApplicationChanges,
  createProfiles,
  createTestJobApplication,
} from "./job-application-test-helpers.js";
import { UpdateJobApplicationContactUseCase } from "./update-job-application-contact.use-case.js";

describe("UpdateJobApplicationContactUseCase", () => {
  it("validates contact membership before updating it", async () => {
    const job = createTestJobApplication();
    const contact = createContact();
    const repository = createJobApplicationRepository({
      findById: vi.fn(async () => job),
      findContactById: vi.fn(async () => contact),
      updateContact: vi.fn(async () => ({ ...contact, role: "Hiring Manager" })),
    });
    const { changes, publish } = createJobApplicationChanges();

    await new UpdateJobApplicationContactUseCase(repository, createProfiles(), changes).execute(
      job.id,
      contact.id,
      "user-1",
      { role: "Hiring Manager" },
    );

    expect(repository.updateContact).toHaveBeenCalledWith(contact.id, { role: "Hiring Manager" });
    expect(publish).toHaveBeenCalledOnce();
  });
});

function createContact(): JobApplicationContact {
  const now = new Date("2026-07-01T09:00:00.000Z");
  return {
    id: "contact-1",
    jobApplicationId: "job-1",
    name: "Grace Hopper",
    createdAt: now,
    updatedAt: now,
  };
}
