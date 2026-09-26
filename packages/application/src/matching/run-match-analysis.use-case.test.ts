import { describe, expect, it } from "vitest";
import { richDocumentFromText } from "@careerden/domain";
import type { AiGenerateParams, AiProvider, ScrapeBundle, UserProfile } from "@careerden/domain";
import { RunMatchAnalysisUseCase } from "./run-match-analysis.use-case.js";

describe("RunMatchAnalysisUseCase", () => {
  it("computes a deterministic score and prompts for one tips entry per profile item", async () => {
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
        summaryTips: [aiTip("Lead with your production TypeScript work.")],
        coverLetterContent:
          "I am applying for the Backend Engineer role with production TypeScript experience.",
        interviewTips: ["Prepare TypeScript service examples."],
        experienceTips: [
          { experienceIndex: 0, tips: [aiTip("Mention collaborating with product partners.")] },
          { experienceIndex: 1, tips: [] },
        ],
      },
    ]);

    const analysis = await new RunMatchAnalysisUseCase(aiProvider).execute({
      jobApplicationId: "job-1",
      profile: createProfile(),
      applicationPackPreferences: { language: "tr-TR", tone: "concise" },
      scrape: createScrape(),
    });

    expect(analysis.matchScore).toBe(50);
    expect(analysis.experienceTips).toHaveLength(2);
    expect(calls).toHaveLength(1);

    const call = calls[0];
    expect(call?.system).toContain(
      "You are an expert career matching and recruiter-facing CV optimization assistant.",
    );
    expect(call?.system).toContain("Treat userProfile as the only source of truth");
    expect(call?.system).toContain("Do not convert personal projects into employment experience");
    expect(call?.system).toContain("Do not upgrade familiarity into expertise");
    expect(call?.system).toContain("Soft skills may be phrased more naturally");
    expect(call?.system).toContain("as short actionable tips the user chooses whether to apply");
    expect(call?.system).toContain(
      "It is normal and expected for a strong, already-relevant profile item to need no tips at all",
    );

    const prompt = parsePrompt(call);

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
    expect(prompt.tipWritingRules).toContain(
      "Each tip text is one short sentence describing a specific, concrete change — not a rewrite of the field.",
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

  it("reports the completeness requirement counts and indexes for every profile section", async () => {
    const { aiProvider, calls } = createAiProvider([completeResponse()]);

    await new RunMatchAnalysisUseCase(aiProvider).execute({
      jobApplicationId: "job-1",
      profile: createProfile(),
      scrape: createScrape(),
    });

    const prompt = parsePrompt(calls[0]);

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
    expect(prompt.requiredOutput?.experienceTips).toContain(
      "Required array with exactly one item per zero-based userProfile.experience index",
    );
  });

  it("weights must-have requirements twice as heavily as nice-to-haves", async () => {
    const { aiProvider } = createAiProvider([
      {
        ...completeResponse(),
        requirementEvaluations: [
          {
            requirement: "Build production TypeScript services",
            status: "matched",
            evidence: ["Built TypeScript automation"],
            priority: "must",
          },
          {
            requirement: "Collaborate with product and design",
            status: "partial",
            evidence: ["Worked with product partners"],
          },
          {
            requirement: "Kubernetes operations",
            status: "missing",
            evidence: [],
            priority: "nice",
          },
        ],
      },
    ]);

    const analysis = await new RunMatchAnalysisUseCase(aiProvider).execute({
      jobApplicationId: "job-1",
      profile: createProfile(),
      scrape: createScrape(),
    });

    // (2 matched + 1 of 2 partial, unprioritized counts as must) / (2 + 2 + 1)
    expect(analysis.matchScore).toBe(60);
  });

  it("fills a profile index the model omitted with an empty tips array rather than dropping it", async () => {
    const { aiProvider } = createAiProvider([
      {
        ...completeResponse(),
        experienceTips: [{ experienceIndex: 0, tips: [aiTip("Mention the migration project.")] }],
      },
    ]);

    const analysis = await new RunMatchAnalysisUseCase(aiProvider).execute({
      jobApplicationId: "job-1",
      profile: createProfile(),
      scrape: createScrape(),
    });

    expect(analysis.experienceTips).toEqual([
      { experienceIndex: 0, tips: [{ text: "Mention the migration project." }] },
      { experienceIndex: 1, tips: [] },
    ]);
  });

  it("strips only the sentence carrying an unsupported duration claim", async () => {
    const { aiProvider } = createAiProvider([
      {
        ...completeResponse(),
        coverLetterContent:
          "I bring 9 years of TypeScript experience. I built production services at Analytical Engines.",
        summaryTips: [aiTip("Delivered backend services over 9 years.")],
        interviewTips: ["Explain your production TypeScript work."],
      },
    ]);

    const analysis = await new RunMatchAnalysisUseCase(aiProvider).execute({
      jobApplicationId: "job-1",
      profile: createProfile({ summary: "Backend engineer building TypeScript services." }),
      scrape: createScrape(),
    });

    expect(analysis.coverLetterContent).toBe("I built production services at Analytical Engines.");
    // The tip is a single sentence, so stripping would empty it; it is redacted instead.
    expect(analysis.summaryTips).toEqual([{ text: "Delivered backend services." }]);
    expect(analysis.interviewTips).toEqual(["Explain your production TypeScript work."]);
  });

  it("redacts the phrase instead of emptying a field when every sentence carries a bad claim", async () => {
    const { aiProvider } = createAiProvider([
      {
        ...completeResponse(),
        coverLetterContent: "I offer 9 years of TypeScript experience building backend services.",
      },
    ]);

    const analysis = await new RunMatchAnalysisUseCase(aiProvider).execute({
      jobApplicationId: "job-1",
      profile: createProfile({ summary: "Backend engineer building TypeScript services." }),
      scrape: createScrape(),
    });

    expect(analysis.coverLetterContent).toBe(
      "I offer TypeScript experience building backend services.",
    );
    expect(analysis.coverLetterContent).not.toContain("9 years");
  });

  it("keeps duration claims the profile's own dates support", async () => {
    const { aiProvider } = createAiProvider([
      {
        ...completeResponse(),
        coverLetterContent: "I offer 4 years of TypeScript experience building backend services.",
      },
    ]);

    const analysis = await new RunMatchAnalysisUseCase(aiProvider).execute({
      jobApplicationId: "job-1",
      profile: createProfile({ startDate: "2018-01", endDate: "2024-01" }),
      scrape: createScrape(),
    });

    expect(analysis.coverLetterContent).toContain("4 years of TypeScript experience");
  });

  it("keeps AI-generated duration claims when the exact duration exists in the profile text", async () => {
    const { aiProvider } = createAiProvider([
      {
        ...completeResponse(),
        coverLetterContent: "I offer 4 years of TypeScript experience building backend services.",
        summaryTips: [aiTip("Delivered backend services with 4 years of TypeScript work.")],
      },
    ]);

    const analysis = await new RunMatchAnalysisUseCase(aiProvider).execute({
      jobApplicationId: "job-1",
      profile: createProfile({
        summary: "Backend engineer with 4 years of TypeScript experience.",
      }),
      scrape: createScrape(),
    });

    expect(analysis.coverLetterContent).toContain("4 years of TypeScript experience");
    expect(analysis.summaryTips).toEqual([
      { text: "Delivered backend services with 4 years of TypeScript work." },
    ]);
  });

  it("never returns an empty cover letter", async () => {
    const { aiProvider } = createAiProvider([
      {
        ...completeResponse(),
        coverLetterContent: "",
        strongSkills: ["TypeScript", "Node.js"],
      },
    ]);

    const analysis = await new RunMatchAnalysisUseCase(aiProvider).execute({
      jobApplicationId: "job-1",
      profile: createProfile({ summary: "Backend engineer building TypeScript services." }),
      scrape: createScrape(),
    });

    expect(analysis.coverLetterContent).toContain("Backend Engineer");
    expect(analysis.coverLetterContent).toContain("Example Inc");
    expect(analysis.coverLetterContent).toContain("TypeScript");
  });

  it("accepts an empty skills/certifications tips list — no fallback ranking is generated", async () => {
    const { aiProvider } = createAiProvider([
      { ...completeResponse(), skillsTips: [], certificationsTips: [] },
    ]);

    const analysis = await new RunMatchAnalysisUseCase(aiProvider).execute({
      jobApplicationId: "job-1",
      profile: createProfile({ skills: ["Gardening", "TypeScript"] }),
      scrape: createScrape(),
    });

    expect(analysis.skillsTips).toEqual([]);
    expect(analysis.certificationsTips).toEqual([]);
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
    rule?: string;
  };
  deterministicScoringGuidance?: Record<string, string>;
  durationClaimRules?: string[];
  matchingMethodology?: string[];
  missingSkillResourceGuidance?: Record<string, unknown>;
  outputPreferences?: Record<string, string>;
  requiredOutput?: Record<string, string>;
  tipWritingRules?: string[];
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
    summaryTips: [aiTip("Lead with the TypeScript automation project.")],
    coverLetterContent: "I am applying for the Backend Engineer role at Example Inc.",
    interviewTips: ["Prepare TypeScript service examples."],
    experienceTips: [
      { experienceIndex: 0, tips: [aiTip("Mention the production automation work.")] },
      { experienceIndex: 1, tips: [] },
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

function aiTip(text: string, requirement = "", evidence = "") {
  return { text, requirement, evidence };
}
