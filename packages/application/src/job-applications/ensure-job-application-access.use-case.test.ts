import { describe, expect, it, vi } from "vitest";
import {
  createJobApplicationRepository,
  createProfiles,
  createTestJobApplication,
} from "./job-application-test-helpers.js";
import { EnsureJobApplicationAccessUseCase } from "./ensure-job-application-access.use-case.js";

describe("EnsureJobApplicationAccessUseCase", () => {
  it("hides a job application owned by another user", async () => {
    const job = createTestJobApplication();
    const profiles = createProfiles();
    vi.mocked(profiles.findUserIdByProfileId).mockResolvedValue("user-2");

    await expect(
      new EnsureJobApplicationAccessUseCase(
        createJobApplicationRepository({ findById: vi.fn(async () => job) }),
        profiles,
      ).execute(job.id, "user-1"),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});
