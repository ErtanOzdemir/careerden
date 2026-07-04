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
        requirementEvaluations: [
          {
            requirement: "Production TypeScript experience",
            status: "matched",
            evidence: ["Built production TypeScript automation"],
          },
          {
            requirement: "Kubernetes",
            status: "missing",
            evidence: [],
          },
        ],
        missingSkillResources: [
          {
            skill: "Kubernetes",
            title: "Kubernetes Basics",
            url: "https://kubernetes.io/docs/tutorials/kubernetes-basics/",
            type: "tutorial",
            reason: "Introduces the core Kubernetes concepts required by the role.",
          },
        ],
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

  it("rejects unknown requirement evaluation statuses", () => {
    expect(() =>
      aiMatchResultSchema.parse({
        matchScore: 82,
        missingSkills: [],
        strongSkills: ["TypeScript"],
        recommendedAchievements: [],
        customizedSummary: "A short profile-aware summary.",
        interviewTips: [],
        requirementEvaluations: [
          {
            requirement: "Production TypeScript experience",
            status: "likely",
            evidence: ["Built production TypeScript automation"],
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects invalid missing skill resource links", () => {
    expect(() =>
      aiMatchResultSchema.parse({
        matchScore: 82,
        missingSkills: ["Kubernetes"],
        strongSkills: ["TypeScript"],
        recommendedAchievements: [],
        customizedSummary: "A short profile-aware summary.",
        interviewTips: [],
        missingSkillResources: [
          {
            skill: "Kubernetes",
            title: "Kubernetes Basics",
            url: "not-a-url",
            type: "tutorial",
            reason: "Introduces Kubernetes concepts.",
          },
        ],
      }),
    ).toThrow();
  });
});
