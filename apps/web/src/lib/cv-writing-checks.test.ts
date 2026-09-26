import { describe, expect, it } from "vitest";
import { richDocumentFromText } from "@careerden/contracts";
import type { ApiDocumentContent } from "../api/types.js";
import { findWritingIssues } from "./cv-writing-checks.js";

function content(overrides: Partial<ApiDocumentContent>): ApiDocumentContent {
  return {
    certificationSuggestions: [],
    customizedSummary: richDocumentFromText("Backend engineer building payment systems."),
    educationEnhancements: [],
    experienceEnhancements: [],
    projectEnhancements: [],
    skillSuggestions: [],
    ...overrides,
  };
}

function experience(...lines: string[]): ApiDocumentContent["experienceEnhancements"][number] {
  return { experienceIndex: 0, description: richDocumentFromText(lines.join("\n")) };
}

describe("findWritingIssues", () => {
  it("returns nothing for strong, concise lines", () => {
    expect(
      findWritingIssues(
        content({
          experienceEnhancements: [
            experience("Cut checkout latency by 40% by caching quotes.", "Led 3 engineers."),
          ],
        }),
      ),
    ).toEqual([]);
  });

  it("flags weak openers, first person, missing numbers, and very long lines", () => {
    const messages = findWritingIssues(
      content({
        experienceEnhancements: [
          experience(
            "Responsible for the billing service.",
            "I improved the deployment pipeline for the whole company across every product team so that releases were safer and faster than they had ever been before in the history of the organisation and its customers today.",
          ),
        ],
      }),
    ).map((issue) => issue.message);

    expect(messages).toEqual([
      "Uses “Responsible for” — lead with what you did or achieved instead.",
      "One line is 36 words — split it or trim it to under 30.",
      "Drop first-person words like “I” or “my” — CV lines usually start with a verb.",
      "No numbers here — add a measurable result if you have one (users, team size, time saved).",
    ]);
  });

  it("recognises weak Turkish phrasing anywhere in the line", () => {
    expect(
      findWritingIssues(
        content({ experienceEnhancements: [experience("Ödeme servisinde görev aldım.")] }),
      ).map((issue) => issue.message),
    ).toEqual(["Uses “görev aldım” — lead with what you did or achieved instead."]);
  });

  it("flags an empty summary and a verb repeated across experience lines", () => {
    const issues = findWritingIssues(
      content({
        customizedSummary: richDocumentFromText(""),
        experienceEnhancements: [
          experience("Developed the API in 2 weeks.", "Developed the UI for 3 teams."),
          { experienceIndex: 1, description: richDocumentFromText("Developed 4 reports.") },
        ],
      }),
    );

    expect(issues.map((issue) => issue.message)).toEqual([
      "The summary is empty — add two or three lines on who you are.",
      "“Developed” starts 3 lines across your experience — vary your verbs.",
    ]);
  });
});
