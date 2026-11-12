import { describe, expect, it } from "vitest";
import type { AiMatchResultCandidateDto } from "@careerden/contracts";
import { aiMatchResultCandidateSchema, aiMatchResultSchema } from "@careerden/contracts";
import type { UserProfile } from "@careerden/domain";
import { normalizeAiMatchResult } from "./normalize-ai-match-result.js";

describe("normalizeAiMatchResult", () => {
  it("drops blank strings the strict schema would have rejected", () => {
    const result = normalizeAiMatchResult(
      createCandidate({
        missingSkills: ["Kubernetes", "", "  "],
        strongSkills: [" TypeScript "],
        interviewTips: [""],
      }),
      createProfile(),
      [],
    );

    expect(result.missingSkills).toEqual(["Kubernetes"]);
    expect(result.strongSkills).toEqual(["TypeScript"]);
    expect(result.interviewTips).toEqual([]);
  });

  it("rounds and clamps a fractional score", () => {
    expect(
      normalizeAiMatchResult(createCandidate({ matchScore: 87.6 }), createProfile(), []).matchScore,
    ).toBe(88);
    expect(
      normalizeAiMatchResult(createCandidate({ matchScore: 140 }), createProfile(), []).matchScore,
    ).toBe(100);
    expect(
      normalizeAiMatchResult(createCandidate({ matchScore: -5 }), createProfile(), []).matchScore,
    ).toBe(0);
  });

  it("drops a malformed resource rather than failing the analysis", () => {
    const result = normalizeAiMatchResult(
      createCandidate({
        missingSkillResources: [
          {
            skill: "Kubernetes",
            title: "Docs",
            url: "not a url",
            type: "documentation",
            reason: "Learn the basics",
          },
          {
            skill: "Kubernetes",
            title: "Guide",
            url: "https://kubernetes.io/docs/",
            type: "documentation",
            reason: "Official guide",
          },
        ],
      }),
      createProfile(),
      [],
    );

    expect(result.missingSkillResources).toHaveLength(1);
    expect(result.missingSkillResources?.[0]?.url).toBe("https://kubernetes.io/docs/");
  });

  it("dedupes tip indexes and drops ones outside the profile", () => {
    const result = normalizeAiMatchResult(
      createCandidate({
        experienceTips: [
          { experienceIndex: 0, tips: [aiTip("First")] },
          { experienceIndex: 0, tips: [aiTip("Second wins")] },
          { experienceIndex: 9, tips: [aiTip("Out of range")] },
        ],
      }),
      createProfile(),
      [],
    );

    expect(result.experienceTips).toEqual([
      { experienceIndex: 0, tips: [{ text: "Second wins" }] },
    ]);
  });

  it("keeps only requirement and evidence links it can verify", () => {
    const result = normalizeAiMatchResult(
      createCandidate({
        summaryTips: [
          aiTip(
            "Lead with the migration.",
            "build production typescript services",
            "Migrated billing to PostgreSQL",
          ),
          aiTip("Claim leadership.", "Lead a team of engineers", "Led a team of 8 engineers"),
          aiTip("Tighten wording.", "", ""),
        ],
      }),
      createProfile({ description: "Migrated billing to PostgreSQL with zero downtime." }),
      ["Build production TypeScript services"],
    );

    expect(result.summaryTips).toEqual([
      {
        text: "Lead with the migration.",
        requirement: "Build production TypeScript services",
        evidence: "Migrated billing to PostgreSQL",
      },
      { text: "Claim leadership." },
      { text: "Tighten wording." },
    ]);
  });

  it("keeps list tips as bare item names and drops duplicates and blanks", () => {
    const result = normalizeAiMatchResult(
      createCandidate({
        skillsTips: [
          { item: " Node.js ", text: "Add Node.js — your projects use it.", requirement: "" },
          { item: "node.js", text: "Duplicate.", requirement: "" },
          { item: "", text: "No item.", requirement: "" },
          { item: "Real-time systems", text: "", requirement: "Real-time systems" },
        ],
      }),
      createProfile(),
      ["Real-time systems"],
    );

    expect(result.skillsTips).toEqual([
      { item: "Node.js", text: "Add Node.js — your projects use it." },
      { item: "Real-time systems", text: "Real-time systems", requirement: "Real-time systems" },
    ]);
  });

  it("keeps gap questions that target a real profile item and verifies their requirement", () => {
    const result = normalizeAiMatchResult(
      createCandidate({
        gapQuestions: [
          {
            question: " Did you run these services on Kubernetes? ",
            requirement: "Kubernetes operations",
            fieldType: "experience",
            fieldIndex: 0,
          },
          {
            question: "Did you run these services on Kubernetes?",
            requirement: "",
            fieldType: "experience",
            fieldIndex: 0,
          },
          { question: "Out of range?", requirement: "", fieldType: "project", fieldIndex: 0 },
          {
            question: "What was the headline result?",
            requirement: "Invented requirement",
            fieldType: "summary",
            fieldIndex: 7,
          },
        ],
      }),
      createProfile(),
      ["Kubernetes operations"],
    );

    expect(result.gapQuestions).toEqual([
      {
        question: "Did you run these services on Kubernetes?",
        requirement: "Kubernetes operations",
        field: { type: "experience", index: 0 },
      },
      { question: "What was the headline result?", field: { type: "summary" } },
    ]);
  });

  it("keeps a requirement priority when the model provides one", () => {
    const result = normalizeAiMatchResult(
      createCandidate({
        requirementEvaluations: [
          { requirement: "Kubernetes", status: "missing", evidence: [], priority: "nice" },
          { requirement: "TypeScript", status: "matched", evidence: ["Built TypeScript"] },
        ],
      }),
      createProfile(),
      [],
    );

    expect(result.requirementEvaluations).toEqual([
      { requirement: "Kubernetes", status: "missing", evidence: [], priority: "nice" },
      { requirement: "TypeScript", status: "matched", evidence: ["Built TypeScript"] },
    ]);
  });

  it("produces output the strict schema accepts", () => {
    const result = normalizeAiMatchResult(createCandidate({}), createProfile(), []);

    expect(() => aiMatchResultSchema.parse(result)).not.toThrow();
  });
});

describe("aiMatchResultCandidateSchema", () => {
  it("accepts what the strict schema rejects, so generation never fails on it", () => {
    const raw = {
      ...createCandidate({}),
      coverLetterContent: "",
      matchScore: 87.5,
      missingSkillResources: [
        { skill: "Go", title: "Docs", url: "nope", type: "documentation", reason: "Learn" },
      ],
    };

    expect(() => aiMatchResultCandidateSchema.parse(raw)).not.toThrow();
    expect(() => aiMatchResultSchema.parse(raw)).toThrow();
  });
});

function createCandidate(overrides: Partial<AiMatchResultCandidateDto>): AiMatchResultCandidateDto {
  return {
    coverLetterContent: "I am applying for the Backend Engineer role.",
    matchScore: 50,
    missingSkills: [],
    strongSkills: ["TypeScript"],
    summaryTips: [aiTip("Lead with the TypeScript automation project.")],
    interviewTips: ["Prepare examples."],
    experienceTips: [{ experienceIndex: 0, tips: [aiTip("Mention the production work.")] }],
    ...overrides,
  };
}

function createProfile(overrides: { description?: string } = {}): UserProfile {
  return {
    id: "profile-1",
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    autoRunMatchAnalysis: true,
    autoGenerateDocuments: true,
    followUpRemindersEnabled: true,
    links: [],
    skillGroups: [],
    experience: [
      {
        company: "Analytical Engines",
        title: "Backend Engineer",
        description: overrides.description,
      },
    ],
    education: [],
    certifications: [],
    projects: [],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function aiTip(text: string, requirement = "", evidence = "") {
  return { text, requirement, evidence };
}
