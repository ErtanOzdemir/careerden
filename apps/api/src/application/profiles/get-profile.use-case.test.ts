import { describe, expect, it, vi } from "vitest";
import { ApplicationError } from "@careerden/application";
import { GetProfileUseCase } from "./get-profile.use-case.js";
import { createProfileRepository, createTestProfile } from "./profile-test-helpers.js";

describe("GetProfileUseCase", () => {
  it("returns the profile belonging to the current user", async () => {
    const profile = createTestProfile();
    const profiles = createProfileRepository(profile);

    await expect(new GetProfileUseCase(profiles).execute(profile.id, "user-1")).resolves.toBe(
      profile,
    );
  });

  it("hides profiles owned by another user", async () => {
    const profiles = createProfileRepository();
    vi.mocked(profiles.findUserIdByProfileId).mockResolvedValue("user-2");

    await expect(new GetProfileUseCase(profiles).execute("profile-1", "user-1")).rejects.toEqual(
      new ApplicationError("not_found", "Profile not found"),
    );
  });
});
