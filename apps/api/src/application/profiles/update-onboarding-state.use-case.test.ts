import { describe, expect, it } from "vitest";
import { UpdateOnboardingStateUseCase } from "./update-onboarding-state.use-case.js";
import { createProfileRepository, createTestProfile } from "./profile-test-helpers.js";

const now = new Date("2026-10-31T12:00:00.000Z");

describe("UpdateOnboardingStateUseCase", () => {
  it("stamps completion and checklist dismissal with the server clock", async () => {
    const profile = createTestProfile();
    const profiles = createProfileRepository(profile);

    await new UpdateOnboardingStateUseCase(profiles, () => now).execute(profile.id, "user-1", {
      completed: true,
      checklistDismissed: true,
    });

    expect(profiles.update).toHaveBeenCalledWith(profile.id, {
      onboardingCompletedAt: now,
      onboardingChecklistDismissedAt: now,
    });
  });

  it("clears completion to restart onboarding without touching the checklist", async () => {
    const profile = createTestProfile();
    const profiles = createProfileRepository(profile);

    await new UpdateOnboardingStateUseCase(profiles, () => now).execute(profile.id, "user-1", {
      completed: false,
    });

    expect(profiles.update).toHaveBeenCalledWith(profile.id, { onboardingCompletedAt: null });
  });

  it("rejects profiles owned by another user", async () => {
    const profile = createTestProfile();
    const profiles = createProfileRepository(profile);

    await expect(
      new UpdateOnboardingStateUseCase(profiles).execute(profile.id, "user-2", { completed: true }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(profiles.update).not.toHaveBeenCalled();
  });
});
