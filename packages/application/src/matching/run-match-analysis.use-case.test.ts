import { describe, expect, it } from "vitest";
import { richDocumentFromText } from "@careerden/domain";
import type { AiGenerateParams, AiProvider, ScrapeBundle, UserProfile } from "@careerden/domain";
import { RunMatchAnalysisUseCase } from "./run-match-analysis.use-case.js";

describe("RunMatchAnalysisUseCase", () => {
  it("computes a deterministic score and prompts for one grounded enhancement per profile item", async () => {
    const { aiProvider, calls } = createAiProvider([
      {
        matchScore: 5,
        requirementEvaluations: [
          {
            requirement: "Build production TypeScript services",
            status: "matched",
            evidence: ["Built TypeScript automation for production workflows"],
          },
          {
            requirement: "Collaborate with product and design",
            status: "partial",
            evidence: ["Worked with product partners"],
          },
          { requirement: "Kubernetes operations", status: "missing", evidence: [] },
        ],
        missingSkills: ["Kubernetes operations"],
        strongSkills: ["TypeScript"],
        recommendedAchievements: ["Built TypeScript automation"],
        coverLetterContent:
          "I am applying for the Backend Engineer role with production TypeScript experience.",
        customizedSummary: "Backend engineer with production TypeScript experience.",
        interviewTips: ["Prepare TypeScript service examples."],
        experienceEnhancements: [
          {
            experienceIndex: 0,
            enhancedDescription:
              "Built production TypeScript automation for backend workflows while collaborating with product partners.",
          },
          {
            experienceIndex: 1,
            enhancedDescription: "Coordinated local community events end to end.",
          },
        ],
      },
    ]);

    const { analysis, diagnostics } = await new RunMatchAnalysisUseCase(aiProvider).execute({
      jobApplicationId: "job-1",
      profile: createProfile(),
      applicationPackPreferences: { language: "tr-TR", tone: "concise" },
      scrape: createScrape(),
    });

    expect(analysis.matchScore).toBe(50);
    expect(analysis.experienceEnhancements).toHaveLength(2);
    expect(diagnostics.repairAttempted).toBe(false);
    expect(diagnostics.filled.experience).toEqual([]);
    expect(calls).toHaveLength(1);

    const call = calls[0];
    expect(call?.system).toContain(
      "You are an expert career matching and recruiter-facing CV optimization assistant.",
    );
    expect(call?.system).toContain("Treat userProfile as the only source of truth");
    expect(call?.system).toContain("Do not convert personal projects into employment experience");
    expect(call?.system).toContain("Do not upgrade familiarity into expertise");
    expect(call?.system).toContain("Soft skills may be phrased more naturally");
    expect(call?.system).toContain("Suggest headline improvements only using supported");
    expect(call?.system).toContain("produce one truthful rewrite for every profile item");

    const prompt = parsePrompt(call);

    expect(prompt.currentSystemOutputMapping).toMatchObject({
      strong_match: "Use requirementEvaluations.status = matched.",
      partial_match: "Use requirementEvaluations.status = partial.",
      missing: "Use requirementEvaluations.status = missing.",
      unclear:
        "Use requirementEvaluations.status = missing and explain the uncertainty in evidence text.",
      "suggestedRewrite.cvSummary": "Use customizedSummary.",
      "suggestedRewrite.coverLetter": "Use coverLetterContent.",
      "suggestedRewrite.skillsOrder": "Use skillSuggestions.",
    });
    expect(prompt.outputPreferences).toEqual({ language: "tr-TR", tone: "concise" });
    expect(prompt.deterministicScoringGuidance?.rule).toContain("matched = 1.0");
    expect(prompt.deterministicScoringGuidance?.rule).toContain(
      "Only classify requirements that appear in scrapedJob.requirements",
    );
    expect(prompt.matchingMethodology).toContain(
      "Do not add requirements from userProfile, CV skills, profile experiences, projects, education, certifications, or inferred strengths unless they correspond to an item in scrapedJob.requirements.",
    );
    expect(prompt.requiredOutput?.requirementEvaluations).toContain(
      "Do not add CV-only or profile-only facts as requirementEvaluations items.",
    );
    expect(prompt.cvOptimizationRules).toContain(
      "Keep each enhancement as one concise prose paragraph of 1-3 sentences without markdown or bullet markers.",
    );
    expect(prompt.durationClaimRules).toContain(
      "Never state total years of experience unless the exact duration claim appears in userProfile.",
    );
    expect(prompt.durationClaimRules).toContain(
      "Never place more than one duration claim in a single sentence.",
    );
    expect(prompt.missingSkillResourceGuidance).toMatchObject({
      rule: "Return 1-3 mixed learning resources for important missing skills only.",
      allowedResourceTypes: ["documentation", "tutorial", "article", "video", "other"],
    });
    expect(prompt.userProfile).not.toHaveProperty("summaryRichText");
    expect(prompt.userProfile?.experience?.[0]).not.toHaveProperty("descriptionRichText");
  });

  it("asks for an enhancement at every profile index and never for omitting unrelated items", async () => {
    const { aiProvider, calls } = createAiProvider([completeResponse()]);

    await new RunMatchAnalysisUseCase(aiProvider).execute({
      jobApplicationId: "job-1",
      profile: createProfile(),
      scrape: createScrape(),
    });

    const call = calls[0];
    const prompt = parsePrompt(call);

    expect(prompt.completenessRequirement?.counts).toEqual({
      experience: 2,
      education: 0,
      projects: 0,
    });
    expect(prompt.completenessRequirement?.indexes).toEqual({
      experience: [0, 1],
      education: [],
      projects: [],
    });
    expect(prompt.completenessRequirement?.rule).toContain("Never omit an index.");
    expect(prompt.completenessRequirement?.lowRelevanceRule).toContain(
      "still return a short truthful rewrite",
    );
    expect(prompt.requiredOutput?.experienceEnhancements).toContain(
      "Required array with exactly one item per zero-based userProfile.experience index",
    );

    const serialized = JSON.stringify(prompt) + (call?.system ?? "");
    expect(serialized).not.toContain("do not include an enhancement for that experience");
    expect(serialized).not.toContain("omit enhancements for unrelated profile experiences");
    expect(serialized).not.toContain("Do not include unrelated experience unless");
    expect(serialized).not.toContain("unrelatedExperienceRule");
  });

  it("strips only the sentence carrying an unsupported duration claim", async () => {
    const { aiProvider } = createAiProvider([
      {
        ...completeResponse(),
        coverLetterContent:
          "I bring 9 years of TypeScript experience. I built production services at Analytical Engines.",
        customizedSummary:
          "Backend engineer with 9 years of experience. Focused on production TypeScript.",
        recommendedAchievements: ["Delivered backend services over 9 years."],
        interviewTips: ["Explain your production TypeScript work."],
      },
    ]);

    const { analysis } = await new RunMatchAnalysisUseCase(aiProvider).execute({
      jobApplicationId: "job-1",
      profile: createProfile({ summary: "Backend engineer building TypeScript services." }),
      scrape: createScrape(),
    });

    expect(analysis.coverLetterContent).toBe("I built production services at Analytical Engines.");
    expect(analysis.customizedSummary).toBe("Focused on production TypeScript.");
    // The achievement is a single sentence, so stripping would empty it; it is redacted instead.
    expect(analysis.recommendedAchievements).toEqual(["Delivered backend services."]);
    expect(analysis.interviewTips).toEqual(["Explain your production TypeScript work."]);
  });

  it("redacts the phrase instead of emptying a field when every sentence carries a bad claim", async () => {
    const { aiProvider } = createAiProvider([
      {
        ...completeResponse(),
        coverLetterContent: "I offer 9 years of TypeScript experience building backend services.",
        customizedSummary: "Backend engineer with 9 years of TypeScript experience.",
      },
    ]);

    const { analysis } = await new RunMatchAnalysisUseCase(aiProvider).execute({
      jobApplicationId: "job-1",
      profile: createProfile({ summary: "Backend engineer building TypeScript services." }),
      scrape: createScrape(),
    });

    expect(analysis.coverLetterContent).toBe(
      "I offer TypeScript experience building backend services.",
    );
    expect(analysis.customizedSummary).toBe("Backend engineer with TypeScript experience.");
    expect(analysis.coverLetterContent).not.toContain("9 years");
  });

  it("keeps duration claims the profile's own dates support", async () => {
    const { aiProvider } = createAiProvider([
      {
        ...completeResponse(),
        coverLetterContent: "I offer 4 years of TypeScript experience building backend services.",
        customizedSummary: "Backend engineer with 4 years of TypeScript experience.",
      },
    ]);

    const { analysis } = await new RunMatchAnalysisUseCase(aiProvider).execute({
      jobApplicationId: "job-1",
      profile: createProfile({ startDate: "2018-01", endDate: "2024-01" }),
      scrape: createScrape(),
    });

    expect(analysis.coverLetterContent).toContain("4 years of TypeScript experience");
    expect(analysis.customizedSummary).toBe(
      "Backend engineer with 4 years of TypeScript experience.",
    );
  });

  it("keeps AI-generated duration claims when the exact duration exists in the profile text", async () => {
    const { aiProvider } = createAiProvider([
      {
        ...completeResponse(),
        coverLetterContent: "I offer 4 years of TypeScript experience building backend services.",
        customizedSummary: "Backend engineer with 4 years of TypeScript experience.",
        recommendedAchievements: ["Delivered backend services with 4 years of TypeScript work."],
      },
    ]);

    const { analysis } = await new RunMatchAnalysisUseCase(aiProvider).execute({
      jobApplicationId: "job-1",
      profile: createProfile({
        summary: "Backend engineer with 4 years of TypeScript experience.",
      }),
      scrape: createScrape(),
    });

    expect(analysis.coverLetterContent).toContain("4 years of TypeScript experience");
    expect(analysis.recommendedAchievements).toEqual([
      "Delivered backend services with 4 years of TypeScript work.",
    ]);
  });

  it("repairs enhancements the first pass omitted", async () => {
    const { aiProvider, calls } = createAiProvider([
      {
        ...completeResponse(),
        experienceEnhancements: [
          { experienceIndex: 0, enhancedDescription: "Built production TypeScript automation." },
        ],
      },
      {
        experienceEnhancements: [
          {
            experienceIndex: 1,
            enhancedDescription: "Coordinated community events and managed on-the-day logistics.",
          },
        ],
      },
    ]);

    const { analysis, diagnostics } = await new RunMatchAnalysisUseCase(aiProvider).execute({
      jobApplicationId: "job-1",
      profile: createProfile(),
      scrape: createScrape(),
    });

    expect(calls).toHaveLength(2);
    expect(diagnostics.repairAttempted).toBe(true);
    expect(diagnostics.filled.experience).toEqual([]);
    expect(analysis.experienceEnhancements).toEqual([
      { experienceIndex: 0, enhancedDescription: "Built production TypeScript automation." },
      {
        experienceIndex: 1,
        enhancedDescription: "Coordinated community events and managed on-the-day logistics.",
      },
    ]);

    const repairPrompt = parsePrompt(calls[1]);
    expect(repairPrompt.itemsNeedingDescriptions?.experience).toEqual([
      {
        experienceIndex: 1,
        title: "Event Coordinator",
        company: "Babbage Events",
        originalDescription: "Organized local community events.",
      },
    ]);
  });

  it("fills from the profile when the repair pass also leaves a gap", async () => {
    const { aiProvider, calls } = createAiProvider([
      {
        ...completeResponse(),
        experienceEnhancements: [
          { experienceIndex: 0, enhancedDescription: "Built production TypeScript automation." },
        ],
      },
      { experienceEnhancements: [] },
    ]);

    const { analysis, diagnostics } = await new RunMatchAnalysisUseCase(aiProvider).execute({
      jobApplicationId: "job-1",
      profile: createProfile(),
      scrape: createScrape(),
    });

    expect(calls).toHaveLength(2);
    expect(diagnostics.filled.experience).toEqual([1]);
    expect(analysis.experienceEnhancements?.[1]).toEqual({
      experienceIndex: 1,
      enhancedDescription: "Organized local community events.",
    });
  });

  it("never returns an empty cover letter or summary", async () => {
    const { aiProvider } = createAiProvider([
      {
        ...completeResponse(),
        coverLetterContent: "",
        customizedSummary: "",
        strongSkills: ["TypeScript", "Node.js"],
      },
    ]);

    const { analysis } = await new RunMatchAnalysisUseCase(aiProvider).execute({
      jobApplicationId: "job-1",
      profile: createProfile({ summary: "Backend engineer building TypeScript services." }),
      scrape: createScrape(),
    });

    expect(analysis.customizedSummary).toBe("Backend engineer building TypeScript services.");
    expect(analysis.coverLetterContent).toContain("Backend Engineer");
    expect(analysis.coverLetterContent).toContain("Example Inc");
    expect(analysis.coverLetterContent).toContain("TypeScript");
  });

  it("falls back to relevance-ranked profile skills when the model suggests none", async () => {
    const { aiProvider } = createAiProvider([
      { ...completeResponse(), skillSuggestions: [], certificationSuggestions: [] },
    ]);

    const { analysis } = await new RunMatchAnalysisUseCase(aiProvider).execute({
      jobApplicationId: "job-1",
      profile: createProfile({ skills: ["Gardening", "TypeScript"] }),
      scrape: createScrape(),
    });

    expect(analysis.skillSuggestions).toEqual(["TypeScript", "Gardening"]);
  });
});

function createAiProvider(responses: Array<Record<string, unknown>>): {
  aiProvider: AiProvider;
  calls: Array<AiGenerateParams<unknown>>;
} {
  const calls: Array<AiGenerateParams<unknown>> = [];
  const queue = [...responses];

  return {
    calls,
    aiProvider: {
      async generate<T>(params: AiGenerateParams<T>): Promise<T> {
        calls.push(params as AiGenerateParams<unknown>);

        return params.outputSchema.parse(queue.shift() ?? {}) as T;
      },
    },
  };
}

function parsePrompt(call?: AiGenerateParams<unknown>): PromptShape {
  return JSON.parse(call?.prompt ?? "{}") as PromptShape;
}

interface PromptShape {
  completenessRequirement?: {
    counts?: Record<string, number>;
    indexes?: Record<string, number[]>;
    lowRelevanceRule?: string;
    rule?: string;
  };
  currentSystemOutputMapping?: Record<string, string>;
  cvOptimizationRules?: string[];
  deterministicScoringGuidance?: Record<string, string>;
  durationClaimRules?: string[];
  itemsNeedingDescriptions?: Record<string, Array<Record<string, unknown>>>;
  matchingMethodology?: string[];
  missingSkillResourceGuidance?: Record<string, unknown>;
  outputPreferences?: Record<string, string>;
  requiredOutput?: Record<string, string>;
  userProfile?: {
    summaryRichText?: unknown;
    experience?: Array<{ descriptionRichText?: unknown }>;
  };
}

function completeResponse(): Record<string, unknown> {
  return {
    matchScore: 80,
    requirementEvaluations: [
      { requirement: "TypeScript experience", status: "matched", evidence: ["Built TypeScript"] },
    ],
    missingSkills: [],
    strongSkills: ["TypeScript"],
    recommendedAchievements: ["Built TypeScript automation"],
    coverLetterContent: "I am applying for the Backend Engineer role at Example Inc.",
    customizedSummary: "Backend engineer focused on production TypeScript.",
    interviewTips: ["Prepare TypeScript service examples."],
    experienceEnhancements: [
      { experienceIndex: 0, enhancedDescription: "Built production TypeScript automation." },
      { experienceIndex: 1, enhancedDescription: "Coordinated local community events." },
    ],
  };
}

function createScrape(): ScrapeBundle {
  return {
    job: {
      title: "Backend Engineer",
      companyName: "Example Inc",
      description:
        "Build production TypeScript services, collaborate with product and design, and operate Kubernetes.",
      requirements: [
        "Build production TypeScript services",
        "Collaborate with product and design",
        "Kubernetes operations",
      ],
      raw: {},
    },
  };
}

function createProfile(
  overrides: {
    summary?: string;
    experienceDescription?: string;
    skills?: string[];
    startDate?: string;
    endDate?: string;
  } = {},
): UserProfile {
  const description =
    overrides.experienceDescription ??
    "Built TypeScript automation for production workflows. Worked with product partners.";

  return {
    id: "profile-1",
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    autoRunMatchAnalysis: true,
    autoGenerateDocuments: true,
    followUpRemindersEnabled: true,
    links: [],
    summary: overrides.summary,
    summaryRichText: richDocumentFromText(overrides.summary ?? ""),
    skills: overrides.skills ?? ["TypeScript"],
    experience: [
      {
        company: "Analytical Engines",
        title: "Backend Engineer",
        startDate: overrides.startDate,
        endDate: overrides.endDate,
        description,
        descriptionRichText: richDocumentFromText(description),
      },
      {
        company: "Babbage Events",
        title: "Event Coordinator",
        description: "Organized local community events.",
        descriptionRichText: richDocumentFromText("Organized local community events."),
      },
    ],
    education: [],
    certifications: [],
    projects: [],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}
