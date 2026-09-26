import { describe, expect, it } from "vitest";
import { richDocumentFromText } from "@careerden/contracts";
import type { ApiDocumentContent } from "../api/types.js";
import { computeKeywordCoverage } from "./keyword-coverage.js";

describe("computeKeywordCoverage", () => {
  it("splits job keywords by whether the draft CV contains them", () => {
    const content: ApiDocumentContent = {
      certificationSuggestions: [],
      customizedSummary: richDocumentFromText("Engineer building React apps."),
      educationEnhancements: [],
      experienceEnhancements: [
        { experienceIndex: 0, description: richDocumentFromText("Ran services on Kubernetes.") },
      ],
      projectEnhancements: [],
      skillSuggestions: ["TypeScript"],
    };

    expect(
      computeKeywordCoverage(
        [
          "React",
          "Kubernetes",
          "TypeScript",
          "GraphQL",
          "Experience running large distributed systems",
        ],
        content,
      ),
    ).toEqual({ matched: ["React", "Kubernetes", "TypeScript"], missing: ["GraphQL"] });
  });
});
