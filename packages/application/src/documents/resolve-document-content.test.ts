import { describe, expect, it } from "vitest";
import type { DocumentContent, UserProfile } from "@careerden/domain";
import { richDocumentFromText, richDocumentToPlainText } from "@careerden/domain";
import { resolveDocumentContent } from "./resolve-document-content.js";

describe("resolveDocumentContent", () => {
  it("resolves edited AI content and mixed selections into final CV sections", () => {
    const profile = createProfile();
    const content: DocumentContent = {
      certificationSuggestions: ["AWS Practitioner"],
      coverLetterContent: richDocumentFromText("Reviewed cover letter."),
      customizedSummary: richDocumentFromText("AI summary."),
      formatVersion: 2,
      educationEnhancements: [
        { description: richDocumentFromText("AI education details."), educationIndex: 0 },
      ],
      experienceEnhancements: [
        { description: richDocumentFromText("AI experience description."), experienceIndex: 0 },
      ],
      projectEnhancements: [
        { description: richDocumentFromText("AI project description."), projectIndex: 0 },
      ],
      selections: {
        education: {},
        experience: { "0": { description: "ai" } },
        projects: { "0": { description: "original" } },
      },
      skillSuggestions: ["TypeScript", "React"],
    };

    const resolved = resolveDocumentContent(profile, content);

    expect(richDocumentToPlainText(resolved.summary)).toBe("AI summary.");
    expect(resolved.skills).toEqual(["TypeScript", "React"]);
    expect(resolved.certifications).toEqual(["AWS Practitioner"]);
    expect(richDocumentToPlainText(resolved.coverLetterContent)).toBe("Reviewed cover letter.");
    expect(richDocumentToPlainText(resolved.experiences[0]!.description!)).toBe(
      "AI experience description.",
    );
    expect(richDocumentToPlainText(resolved.education[0]!.description!)).toBe(
      "AI education details.",
    );
    expect(richDocumentToPlainText(resolved.projects[0]!.description!)).toBe(
      "Original project description. Original project achievement one. Original project achievement two.",
    );
  });

  it("uses profile content for original selections and as the fallback for empty suggestions", () => {
    const profile = createProfile();
    const content: DocumentContent = {
      certificationSuggestions: [],
      customizedSummary: richDocumentFromText("AI summary."),
      formatVersion: 2,
      educationEnhancements: [
        { description: richDocumentFromText("AI education details."), educationIndex: 0 },
      ],
      experienceEnhancements: [
        { description: richDocumentFromText("AI experience description."), experienceIndex: 0 },
      ],
      selections: {
        certifications: "ai",
        customizedSummary: "original",
        education: { "0": { description: "original" } },
        experience: { "0": { description: "original" } },
        projects: {},
        skills: "ai",
      },
      skillSuggestions: [],
    };

    const resolved = resolveDocumentContent(profile, content);

    expect(richDocumentToPlainText(resolved.summary)).toBe("Original summary.");
    expect(resolved.skills).toEqual(profile.skills);
    expect(resolved.certifications).toEqual(profile.certifications);
    expect(richDocumentToPlainText(resolved.experiences[0]!.description!)).toBe(
      "Original experience description.",
    );
    // Education now has a profile-side description, so choosing the original no longer blanks it.
    expect(richDocumentToPlainText(resolved.education[0]!.description!)).toBe(
      "Original education description.",
    );
  });

  it("falls back to the profile description when the AI left an item without one", () => {
    const profile = createProfile();
    const resolved = resolveDocumentContent(profile, {
      customizedSummary: richDocumentFromText("Summary"),
      formatVersion: 2,
      experienceEnhancements: [{ experienceIndex: 0 }],
      educationEnhancements: [{ educationIndex: 0 }],
      selections: { experience: {}, education: {}, projects: {} },
    });

    expect(richDocumentToPlainText(resolved.experiences[0]!.description!)).toBe(
      "Original experience description.",
    );
    expect(richDocumentToPlainText(resolved.education[0]!.description!)).toBe(
      "Original education description.",
    );
  });

  it("uses one merged profile description for original project content", () => {
    const profile = createProfile();
    const resolved = resolveDocumentContent(profile, {
      customizedSummary: richDocumentFromText("Summary"),
      formatVersion: 2,
      experienceEnhancements: [],
      selections: {
        experience: {},
        education: {},
        projects: { "0": { description: "original" } },
      },
    });

    expect(richDocumentToPlainText(resolved.projects[0]!.description!)).toBe(
      "Original project description. Original project achievement one. Original project achievement two.",
    );
  });
});

function createProfile(): UserProfile {
  return {
    autoGenerateDocuments: true,
    autoRunMatchAnalysis: true,
    certifications: ["Azure Fundamentals"],
    createdAt: new Date("2026-07-14T00:00:00.000Z"),
    education: [
      {
        degree: "BSc",
        description: "Original education description.",
        field: "Computer Science",
        institution: "Example University",
      },
    ],
    email: "ada@example.com",
    experience: [
      {
        company: "Acme",
        description: "Original experience description.",
        title: "Engineer",
      },
    ],
    followUpRemindersEnabled: true,
    fullName: "Ada Lovelace",
    id: "profile-1",
    links: ["https://ada.example.com"],
    projects: [
      {
        achievements: ["Original project achievement one.", "Original project achievement two."],
        description: "Original project description.",
        name: "Careerden",
        skills: ["TypeScript"],
      },
    ],
    skills: ["TypeScript"],
    summary: "Original summary.",
    updatedAt: new Date("2026-07-14T00:00:00.000Z"),
  };
}
