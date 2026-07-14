import { describe, expect, it } from "vitest";
import {
  documentContentFromMatchAnalysis,
  normalizeDescriptionOnlyDocumentContent,
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
    expect(content.formatVersion).toBe(2);
    expect(content.experienceEnhancements[0]?.experienceIndex).toBe(2);
    expect(richDocumentToPlainText(content.experienceEnhancements[0]!.description!)).toBe(
      "Improved description. First achievement. Second achievement.",
    );
    expect(content.experienceEnhancements[0]?.achievements).toEqual([]);
  });

  it("collapses legacy per-item achievements using their saved selections", () => {
    const normalized = normalizeDescriptionOnlyDocumentContent(
      {
        experience: [
          {
            company: "Acme",
            title: "Engineer",
            description: "Original experience",
          },
        ],
        education: [{ institution: "Example University" }],
        projects: [
          {
            name: "Compiler",
            description: "Original project",
            skills: [],
            achievements: ["Original project result"],
          },
        ],
      },
      {
        customizedSummary: richDocumentFromText("Summary"),
        experienceEnhancements: [
          {
            experienceIndex: 0,
            description: richDocumentFromText("AI experience"),
            achievements: [
              richDocumentFromText("AI experience result"),
              richDocumentFromText("Excluded result"),
            ],
          },
        ],
        educationEnhancements: [
          {
            educationIndex: 0,
            description: richDocumentFromText("Tailored coursework"),
            achievements: [richDocumentFromText("Graduated with honors")],
          },
        ],
        projectEnhancements: [
          {
            projectIndex: 0,
            description: richDocumentFromText("Tailored project"),
            achievements: [richDocumentFromText("AI project result")],
          },
        ],
        selections: {
          experience: {
            "0": {
              description: "original",
              achievements: { "0": "ai", "1": "original" },
            },
          },
          education: {
            "0": { description: "ai", achievements: { "0": "ai" } },
          },
          projects: {
            "0": { description: "ai", achievements: { "0": "original" } },
          },
        },
      },
    );

    expect(normalized.formatVersion).toBe(2);
    expect(richDocumentToPlainText(normalized.experienceEnhancements[0]!.description!)).toBe(
      "Original experience. AI experience result.",
    );
    expect(richDocumentToPlainText(normalized.educationEnhancements[0]!.description!)).toBe(
      "Tailored coursework. Graduated with honors.",
    );
    expect(richDocumentToPlainText(normalized.projectEnhancements[0]!.description!)).toBe(
      "Tailored project. Original project result.",
    );
    expect(normalized.experienceEnhancements[0]?.achievements).toEqual([]);
    expect(normalized.educationEnhancements[0]?.achievements).toEqual([]);
    expect(normalized.projectEnhancements[0]?.achievements).toEqual([]);
    expect(normalized.selections?.experience["0"]).toEqual({
      description: "ai",
      achievements: {},
    });
    expect(normalized.selections?.education["0"]).toEqual({
      description: "ai",
      achievements: {},
    });
    expect(normalized.selections?.projects["0"]).toEqual({
      description: "ai",
      achievements: {},
    });
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
