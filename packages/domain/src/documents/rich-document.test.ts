import { describe, expect, it } from "vitest";
import {
  documentContentFromMatchAnalysis,
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

  it("creates editable document content from match analysis", () => {
    const content = documentContentFromMatchAnalysis(profileWithThreeExperiences(), {
      customizedSummary: "Tailored summary",
      experienceEnhancements: [{ experienceIndex: 2, enhancedDescription: "Improved description" }],
    });

    expect(richDocumentToPlainText(content.customizedSummary)).toBe("Tailored summary");
    expect(content.formatVersion).toBe(2);
    expect(richDocumentToPlainText(content.experienceEnhancements[2]!.description!)).toBe(
      "Improved description",
    );
  });

  it("emits one entry per profile item so a missing enhancement is visible rather than silent", () => {
    const content = documentContentFromMatchAnalysis(profileWithThreeExperiences(), {
      customizedSummary: "Tailored summary",
      experienceEnhancements: [{ experienceIndex: 1, enhancedDescription: "Only the middle one" }],
    });

    expect(content.experienceEnhancements.map((item) => item.experienceIndex)).toEqual([0, 1, 2]);
    expect(content.experienceEnhancements[0]?.description).toBeUndefined();
    expect(content.experienceEnhancements[2]?.description).toBeUndefined();
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
    experience: [
      { company: "Acme", title: "Engineer" },
      { company: "Babbage", title: "Coordinator" },
      { company: "Analytical Engines", title: "Backend Engineer" },
    ],
    education: [],
    projects: [],
  };
}
