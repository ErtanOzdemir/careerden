import { describe, expect, it } from "vitest";
import { aiMatchResultSchema } from "./ai-match-result.schema.js";

describe("aiMatchResultSchema", () => {
  it("accepts the required AI matching payload", () => {
    expect(() =>
      aiMatchResultSchema.parse({
        matchScore: 82,
        missingSkills: ["Kubernetes"],
        strongSkills: ["TypeScript"],
        recommendedAchievements: ["Reduced processing time by 30%"],
        customizedSummary: "A short profile-aware summary.",
        interviewTips: ["Prepare a system design example."],
        experienceEnhancements: [
          {
            experienceIndex: 0,
            enhancedDescription: "Built reliable TypeScript automation for production workflows.",
            enhancedAchievements: ["Reduced processing time by 30% using TypeScript."],
          },
        ],
      }),
    ).not.toThrow();
  });

  it("rejects scores outside the 0-100 range", () => {
    expect(() =>
      aiMatchResultSchema.parse({
        matchScore: 101,
        missingSkills: [],
        strongSkills: [],
        recommendedAchievements: [],
        customizedSummary: "Invalid score.",
        interviewTips: [],
      }),
    ).toThrow();
  });
});
