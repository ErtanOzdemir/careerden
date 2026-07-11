import { describe, expect, it, vi } from "vitest";
import { UpdateProfileUseCase } from "./update-profile.use-case.js";
import { createProfileRepository, createTestProfile } from "./profile-test-helpers.js";

describe("UpdateProfileUseCase", () => {
  it("authorizes and updates a profile", async () => {
    const profile = createTestProfile();
    const updated = { ...profile, headline: "Computing pioneer" };
    const profiles = createProfileRepository(profile);
    vi.mocked(profiles.update).mockResolvedValue(updated);

    await expect(
      new UpdateProfileUseCase(profiles).execute(profile.id, "user-1", {
        headline: "Computing pioneer",
      }),
    ).resolves.toBe(updated);
  });
});
