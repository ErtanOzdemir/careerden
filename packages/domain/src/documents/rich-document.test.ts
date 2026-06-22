import { describe, expect, it } from "vitest";
import {
  documentContentFromMatchAnalysis,
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
    const content = documentContentFromMatchAnalysis({
      customizedSummary: "Tailored summary",
      experienceEnhancements: [
        {
          experienceIndex: 2,
          enhancedDescription: "Improved description",
          enhancedAchievements: ["First achievement", "Second achievement"],
        },
      ],
    });

    expect(richDocumentToPlainText(content.customizedSummary)).toBe("Tailored summary");
    expect(content.experienceEnhancements[0]?.experienceIndex).toBe(2);
    expect(content.experienceEnhancements[0]?.achievements.map(richDocumentToPlainText)).toEqual([
      "First achievement",
      "Second achievement",
    ]);
  });
});
