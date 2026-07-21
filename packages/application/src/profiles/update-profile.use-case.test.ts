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

  it("derives plain profile text from rich summary and descriptions", async () => {
    const profile = createTestProfile();
    const profiles = createProfileRepository(profile);
    const summaryRichText = {
      version: 1 as const,
      blocks: [
        {
          type: "paragraph" as const,
          children: [{ type: "text" as const, text: "Backend engineer" }],
        },
      ],
    };
    const descriptionRichText = {
      version: 1 as const,
      blocks: [
        {
          type: "bulletList" as const,
          items: [
            {
              blocks: [
                {
                  type: "paragraph" as const,
                  children: [{ type: "text" as const, text: "Built reliable services" }],
                },
              ],
            },
          ],
        },
      ],
    };

    await new UpdateProfileUseCase(profiles).execute(profile.id, "user-1", {
      summaryRichText,
      experience: [
        {
          company: "Careerden",
          title: "Engineer",
          descriptionRichText,
        },
      ],
      projects: [
        {
          name: "Careerden",
          descriptionRichText,
          skills: [],
          achievements: [],
        },
      ],
    });

    expect(profiles.update).toHaveBeenCalledWith(profile.id, {
      summary: "Backend engineer",
      summaryRichText,
      experience: [
        {
          company: "Careerden",
          title: "Engineer",
          description: "Built reliable services",
          descriptionRichText,
        },
      ],
      projects: [
        {
          name: "Careerden",
          description: "Built reliable services",
          descriptionRichText,
          skills: [],
          achievements: [],
        },
      ],
    });
  });
});
