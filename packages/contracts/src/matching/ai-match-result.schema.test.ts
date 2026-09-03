import { describe, expect, it } from "vitest";
import { aiMatchResultSchema } from "./ai-match-result.schema.js";

describe("aiMatchResultSchema", () => {
  it("accepts tip-only enhancement payloads", () => {
    const result = aiMatchResultSchema.parse({
      coverLetterContent: "Dear hiring team, I am excited to apply.",
      matchScore: 82,
      missingSkills: ["Kubernetes"],
      strongSkills: ["TypeScript"],
      summaryTips: ["Lead with the TypeScript automation project."],
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
      experienceTips: [
        {
          experienceIndex: 0,
          tips: ["Mention the production incident you resolved."],
        },
      ],
    });

    expect(result.experienceTips?.[0]).toEqual({
      experienceIndex: 0,
      tips: ["Mention the production incident you resolved."],
    });
  });

  it("accepts an empty tips array for an item that needs no changes", () => {
    const result = aiMatchResultSchema.parse({
      coverLetterContent: "Dear hiring team, I am excited to apply.",
      matchScore: 82,
      missingSkills: [],
      strongSkills: ["TypeScript"],
      summaryTips: [],
      interviewTips: [],
      experienceTips: [{ experienceIndex: 0, tips: [] }],
    });

    expect(result.experienceTips?.[0]).toEqual({ experienceIndex: 0, tips: [] });
  });

  it("rejects scores outside the 0-100 range", () => {
    expect(() =>
      aiMatchResultSchema.parse({
        coverLetterContent: "Dear hiring team, I am excited to apply.",
        matchScore: 101,
        missingSkills: [],
        strongSkills: [],
        summaryTips: [],
        interviewTips: [],
      }),
    ).toThrow();
  });

  it("rejects unknown requirement evaluation statuses", () => {
    expect(() =>
      aiMatchResultSchema.parse({
        coverLetterContent: "Dear hiring team, I am excited to apply.",
        matchScore: 82,
        missingSkills: [],
        strongSkills: ["TypeScript"],
        summaryTips: [],
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
        coverLetterContent: "Dear hiring team, I am excited to apply.",
        matchScore: 82,
        missingSkills: ["Kubernetes"],
        strongSkills: ["TypeScript"],
        summaryTips: [],
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
