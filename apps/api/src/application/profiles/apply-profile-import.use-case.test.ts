import { describe, expect, it, vi } from "vitest";
import { ApplicationError } from "@careerden/application";
import { ApplyProfileImportUseCase } from "./apply-profile-import.use-case.js";
import { createProfileRepository, createTestProfile } from "./profile-test-helpers.js";

describe("ApplyProfileImportUseCase", () => {
  it("saves only what the import adds to the profile", async () => {
    const profile = { ...createTestProfile(), skillGroups: [{ name: "", skills: ["TypeScript"] }] };
    const profiles = createProfileRepository(profile);

    await new ApplyProfileImportUseCase(profiles).execute(profile.id, "user-1", {
      fullName: "Someone Else",
      headline: "Analyst",
      skillGroups: [{ name: "Data", skills: ["typescript", "PostgreSQL"] }],
      summary: "Writes algorithms.",
    });

    expect(profiles.update).toHaveBeenCalledWith(profile.id, {
      headline: "Analyst",
      skillGroups: [
        { name: "Data", skills: ["PostgreSQL"] },
        { name: "", skills: ["TypeScript"] },
      ],
      summary: "Writes algorithms.",
      summaryRichText: {
        version: 1,
        blocks: [{ type: "paragraph", children: [{ type: "text", text: "Writes algorithms." }] }],
      },
    });
  });

  it("returns the unchanged profile when nothing is new", async () => {
    const profile = createTestProfile();
    const profiles = createProfileRepository(profile);

    await expect(
      new ApplyProfileImportUseCase(profiles).execute(profile.id, "user-1", {
        fullName: "Ada",
      }),
    ).resolves.toBe(profile);
    expect(profiles.update).not.toHaveBeenCalled();
  });

  it("refuses another user's profile", async () => {
    const profiles = createProfileRepository();
    vi.mocked(profiles.findUserIdByProfileId).mockResolvedValue("user-2");

    await expect(
      new ApplyProfileImportUseCase(profiles).execute("profile-1", "user-1", { headline: "X" }),
    ).rejects.toEqual(new ApplicationError("not_found", "Profile not found"));
    expect(profiles.update).not.toHaveBeenCalled();
  });
});
