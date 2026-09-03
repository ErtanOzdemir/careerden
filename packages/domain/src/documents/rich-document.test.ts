import { describe, expect, it } from "vitest";
import {
  documentContentFromProfile,
  profileProjectDescriptionAsProse,
  richDocumentFromText,
  richDocumentToPlainText,
} from "./rich-document.js";

describe("rich document conversion", () => {
  it("converts AI text into deterministic paragraphs", () => {
    expect(richDocumentFromText("First line\n\nSecond line")).toEqual({
      version: 1,
      blocks: [
        {
          type: "paragraph",
          children: [{ type: "text", text: "First line" }],
        },
        {
          type: "paragraph",
          children: [{ type: "text", text: "Second line" }],
        },
      ],
    });
  });

  it("seeds editable document content from the profile's own text, not AI output", () => {
    const content = documentContentFromProfile(profileWithThreeExperiences(), {
      coverLetterContent: "Dear hiring team",
    });

    expect(richDocumentToPlainText(content.customizedSummary)).toBe("A backend engineer.");
    expect(content.formatVersion).toBe(2);
    expect(richDocumentToPlainText(content.experienceEnhancements[2]!.description!)).toBe(
      "Backend engineering work.",
    );
    expect(richDocumentToPlainText(content.coverLetterContent!)).toBe("Dear hiring team");
    expect(content.skillSuggestions).toEqual(["TypeScript"]);
    expect(content.certificationSuggestions).toEqual(["AWS"]);
  });

  it("emits one entry per profile item so a missing description is visible rather than silent", () => {
    const content = documentContentFromProfile(profileWithThreeExperiences(), {});

    expect(content.experienceEnhancements.map((item) => item.experienceIndex)).toEqual([0, 1, 2]);
    expect(content.experienceEnhancements[0]?.description).toBeUndefined();
    expect(content.experienceEnhancements[1]?.description).toBeUndefined();
  });

  it("merges profile project achievements into its original prose description", () => {
    const description = profileProjectDescriptionAsProse({
      description: "Built a compiler",
      achievements: ["Improved generated code", "Improved generated code"],
    });

    expect(richDocumentToPlainText(description!)).toBe(
      "Built a compiler. Improved generated code.",
    );
  });
});

function profileWithThreeExperiences() {
  return {
    summary: "A backend engineer.",
    summaryRichText: undefined,
    skills: ["TypeScript"],
    certifications: ["AWS"],
    experience: [
      { company: "Acme", title: "Engineer" },
      { company: "Babbage", title: "Coordinator" },
      { company: "Analytical Engines", title: "Backend Engineer", description: "Backend engineering work." },
    ],
    education: [],
    projects: [],
  };
}
