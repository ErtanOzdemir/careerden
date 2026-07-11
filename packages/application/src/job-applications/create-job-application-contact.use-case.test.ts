import { describe, expect, it, vi } from "vitest";
import type { JobApplicationContact } from "@link2cv/domain";
import { CreateJobApplicationContactUseCase } from "./create-job-application-contact.use-case.js";
import {
  createJobApplicationChanges,
  createJobApplicationRepository,
  createProfiles,
  createTestJobApplication,
} from "./job-application-test-helpers.js";

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
    const { changes, publish } = createJobApplicationChanges();

    await expect(
      new CreateJobApplicationContactUseCase(repository, createProfiles(), changes).execute(
        job.id,
        "user-1",
        { name: contact.name },
      ),
    ).resolves.toBe(contact);
    expect(publish).toHaveBeenCalledOnce();
  });
});
