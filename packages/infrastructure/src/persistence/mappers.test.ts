import { describe, expect, it } from "vitest";
import { richDocumentFromText } from "@link2cv/domain";
import { toUserProfile } from "./mappers.js";

describe("toUserProfile", () => {
  it("preserves stored rich profile content and upgrades legacy descriptions", () => {
    const summaryRichText = richDocumentFromText("Formatted summary");
    const profile = toUserProfile({
      id: "profile-1",
      full_name: "Ada Lovelace",
      email: "ada@example.com",
      summary: "Formatted summary",
      summary_rich_text: summaryRichText,
      links: [],
      skills: [],
      experience: [
        {
          company: "Analytical Engines",
          title: "Engineer",
          description: "Legacy experience description",
        },
      ],
      education: [],
      certifications: [],
      projects: [
        {
          name: "Link2CV",
          description: "Legacy project description",
          skills: [],
          achievements: [],
        },
      ],
      created_at: "2026-07-13T00:00:00.000Z",
      updated_at: "2026-07-13T00:00:00.000Z",
    });

    expect(profile.summaryRichText).toEqual(summaryRichText);
    expect(profile.experience[0]?.descriptionRichText).toEqual(
      richDocumentFromText("Legacy experience description"),
    );
    expect(profile.projects[0]?.descriptionRichText).toEqual(
      richDocumentFromText("Legacy project description"),
    );
  });
});
