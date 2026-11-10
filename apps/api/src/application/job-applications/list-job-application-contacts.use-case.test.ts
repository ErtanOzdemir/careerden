import { describe, expect, it, vi } from "vitest";
import type { JobApplicationContact } from "@careerden/domain";
import { ListJobApplicationContactsUseCase } from "./list-job-application-contacts.use-case.js";
import {
  createJobApplicationRepository,
  createProfiles,
  createTestJobApplication,
} from "@careerden/application/testing";

describe("ListJobApplicationContactsUseCase", () => {
  it("lists the contacts of an owned job application", async () => {
    const job = createTestJobApplication();
    const items = [{ id: "item-1", jobApplicationId: job.id } as JobApplicationContact];
    const repository = createJobApplicationRepository({
      findById: vi.fn(async () => job),
      listContacts: vi.fn(async () => items),
    });

    await expect(
      new ListJobApplicationContactsUseCase(repository, createProfiles()).execute(job.id, "user-1"),
    ).resolves.toBe(items);
    expect(repository.listContacts).toHaveBeenCalledWith(job.id);
  });

  it("hides the contacts of another user's job application", async () => {
    const repository = createJobApplicationRepository({
      findById: vi.fn(async () => createTestJobApplication()),
    });

    await expect(
      new ListJobApplicationContactsUseCase(repository, createProfiles()).execute(
        "job-1",
        "user-2",
      ),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(repository.listContacts).not.toHaveBeenCalled();
  });
});
