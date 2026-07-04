import { describe, expect, it } from "vitest";
import type { AiGenerateParams, AiProvider, UserProfile } from "@link2cv/domain";
import { InMemoryJobApplicationRepository } from "@link2cv/infrastructure";
import { RunMatchAnalysisUseCase } from "./run-match-analysis.js";

describe("RunMatchAnalysisUseCase", () => {
  it("computes a deterministic score from requirement evaluations and prompts grounded description enhancement", async () => {
    const jobApplications = new InMemoryJobApplicationRepository();
    const jobApplication = await jobApplications.create({
      profileId: "profile-1",
      sourceUrl: "https://www.linkedin.com/jobs/view/123",
    });
    const calls: Array<AiGenerateParams<unknown>> = [];

    const aiProvider: AiProvider = {
      async generate<T>(params: AiGenerateParams<T>): Promise<T> {
        calls.push(params as AiGenerateParams<unknown>);

        return params.outputSchema.parse({
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
            {
              requirement: "Kubernetes operations",
              status: "missing",
              evidence: [],
            },
          ],
          missingSkills: ["Kubernetes operations"],
          strongSkills: ["TypeScript"],
          recommendedAchievements: ["Built TypeScript automation"],
          customizedSummary: "Backend engineer with production TypeScript experience.",
          interviewTips: ["Prepare TypeScript service examples."],
          experienceEnhancements: [
            {
              experienceIndex: 0,
              enhancedDescription:
                "Built production TypeScript automation for backend workflows while collaborating with product partners.",
            },
          ],
        }) as T;
      },
    };

    const result = await new RunMatchAnalysisUseCase(aiProvider, jobApplications).execute({
      jobApplicationId: jobApplication.id,
      profile: createProfile(),
      scrape: {
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
      },
    });

    expect(result.matchScore).toBe(50);
    await expect(jobApplications.getMatchAnalysis(jobApplication.id)).resolves.toMatchObject({
      matchScore: 50,
      requirementEvaluations: [
        expect.objectContaining({ status: "matched" }),
        expect.objectContaining({ status: "partial" }),
        expect.objectContaining({ status: "missing" }),
      ],
    });
    expect(result.experienceEnhancements).toHaveLength(1);

    const call = calls[0];
    expect(call?.system).toContain(
      "You are an expert career matching and recruiter-facing CV optimization assistant.",
    );
    expect(call?.system).toContain("Treat userProfile as the only source of truth");
    expect(call?.system).toContain("Do not convert personal projects into employment experience");
    expect(call?.system).toContain("Do not upgrade familiarity into expertise");
    expect(call?.system).toContain("Soft skills may be phrased more naturally");
    expect(call?.system).toContain("Suggest headline improvements only using supported");

    const prompt = JSON.parse(call?.prompt ?? "{}") as {
      currentSystemOutputMapping?: Record<string, string>;
      deterministicScoringGuidance?: Record<string, unknown>;
      cvOptimizationRules?: string[];
      missingSkillResourceGuidance?: Record<string, unknown>;
      matchingMethodology?: string[];
      requiredOutput?: Record<string, string>;
    };

    expect(prompt.currentSystemOutputMapping).toMatchObject({
      strong_match: "Use requirementEvaluations.status = matched.",
      partial_match: "Use requirementEvaluations.status = partial.",
      missing: "Use requirementEvaluations.status = missing.",
      unclear:
        "Use requirementEvaluations.status = missing and explain the uncertainty in evidence text.",
      "suggestedRewrite.cvSummary": "Use customizedSummary.",
      "suggestedRewrite.skillsOrder": "Use skillSuggestions.",
    });
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
      "For missing requirements, never fabricate a match; suggest leaving out, adjacent careful phrasing, truthful learning/project notes only when supported, or asking the user for clarification.",
    );
    expect(prompt.durationClaimRules).toContain(
      "Never state total years of experience unless the exact duration claim appears in userProfile.",
    );
    expect(prompt.missingSkillResourceGuidance).toMatchObject({
      rule: "Return 1-3 mixed learning resources for important missing skills only.",
      allowedResourceTypes: ["documentation", "tutorial", "article", "video", "other"],
    });
    expect(prompt.missingSkillResourceGuidance?.constraints).toContain(
      "Do not invent fake URLs or citations.",
    );
  });

  it("removes AI-generated duration claims that are not present in the profile", async () => {
    const jobApplications = new InMemoryJobApplicationRepository();
    const jobApplication = await jobApplications.create({
      profileId: "profile-1",
      sourceUrl: "https://www.linkedin.com/jobs/view/123",
    });

    const aiProvider: AiProvider = {
      async generate<T>(params: AiGenerateParams<T>): Promise<T> {
        return params.outputSchema.parse({
          matchScore: 80,
          requirementEvaluations: [
            {
              requirement: "TypeScript experience",
              status: "matched",
              evidence: ["4 years of TypeScript development"],
            },
          ],
          missingSkills: [],
          strongSkills: ["TypeScript"],
          recommendedAchievements: [
            "Delivered backend services with 1 year of TypeScript experience.",
          ],
          customizedSummary: "Backend engineer with 1 year of TypeScript experience.",
          interviewTips: ["Explain 1 year of backend delivery."],
          coverLetterGuidance: ["Mention 1 year of TypeScript experience."],
          experienceEnhancements: [
            {
              experienceIndex: 0,
              enhancedDescription:
                "Built production services with 1 year of TypeScript experience.",
              enhancedAchievements: ["Delivered APIs with 1 year of TypeScript work."],
            },
          ],
        }) as T;
      },
    };

    const result = await new RunMatchAnalysisUseCase(aiProvider, jobApplications).execute({
      jobApplicationId: jobApplication.id,
      profile: createProfile({
        summary: "Backend engineer with 4 years of TypeScript experience.",
        experienceDescription: "Built TypeScript automation for production workflows over 4 years.",
      }),
      scrape: {
        job: {
          title: "Backend Engineer",
          companyName: "Example Inc",
          description: "Build TypeScript services.",
          requirements: ["TypeScript experience"],
          raw: {},
        },
      },
    });

    expect(result.customizedSummary).toBe(
      "Backend engineer with 4 years of TypeScript experience.",
    );
    expect(result.recommendedAchievements).toEqual([]);
    expect(result.interviewTips).toEqual([]);
    expect(result.coverLetterGuidance).toEqual([]);
    expect(result.experienceEnhancements).toEqual([]);

    const content = await jobApplications.getDocumentContent(jobApplication.id);
    expect(content?.customizedSummary.blocks[0]?.children[0]?.text).toBe(
      "Backend engineer with 4 years of TypeScript experience.",
    );
    expect(content?.experienceEnhancements).toEqual([]);
  });

  it("keeps AI-generated duration claims when the exact duration exists in the profile", async () => {
    const jobApplications = new InMemoryJobApplicationRepository();
    const jobApplication = await jobApplications.create({
      profileId: "profile-1",
      sourceUrl: "https://www.linkedin.com/jobs/view/123",
    });

    const aiProvider: AiProvider = {
      async generate<T>(params: AiGenerateParams<T>): Promise<T> {
        return params.outputSchema.parse({
          matchScore: 80,
          requirementEvaluations: [
            {
              requirement: "TypeScript experience",
              status: "matched",
              evidence: ["4 years of TypeScript development"],
            },
          ],
          missingSkills: [],
          strongSkills: ["TypeScript"],
          recommendedAchievements: ["Delivered backend services with 4 years of TypeScript work."],
          customizedSummary: "Backend engineer with 4 years of TypeScript experience.",
          interviewTips: ["Explain 4 years of backend delivery."],
          coverLetterGuidance: ["Mention 4 years of TypeScript experience."],
          experienceEnhancements: [
            {
              experienceIndex: 0,
              enhancedDescription:
                "Built production services with 4 years of TypeScript experience.",
            },
          ],
        }) as T;
      },
    };

    const result = await new RunMatchAnalysisUseCase(aiProvider, jobApplications).execute({
      jobApplicationId: jobApplication.id,
      profile: createProfile({
        summary: "Backend engineer with 4 years of TypeScript experience.",
        experienceDescription: "Built TypeScript automation for production workflows over 4 years.",
      }),
      scrape: {
        job: {
          title: "Backend Engineer",
          companyName: "Example Inc",
          description: "Build TypeScript services.",
          requirements: ["TypeScript experience"],
          raw: {},
        },
      },
    });

    expect(result.customizedSummary).toBe(
      "Backend engineer with 4 years of TypeScript experience.",
    );
    expect(result.recommendedAchievements).toEqual([
      "Delivered backend services with 4 years of TypeScript work.",
    ]);
    expect(result.interviewTips).toEqual(["Explain 4 years of backend delivery."]);
    expect(result.coverLetterGuidance).toEqual(["Mention 4 years of TypeScript experience."]);
    expect(result.experienceEnhancements?.[0]?.enhancedDescription).toBe(
      "Built production services with 4 years of TypeScript experience.",
    );
  });
});

function createProfile(
  overrides: {
    summary?: string;
    experienceDescription?: string;
  } = {},
): UserProfile {
  return {
    id: "profile-1",
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    autoRunMatchAnalysis: true,
    links: [],
    summary: overrides.summary,
    skills: ["TypeScript"],
    experience: [
      {
        company: "Analytical Engines",
        title: "Backend Engineer",
        description:
          overrides.experienceDescription ??
          "Built TypeScript automation for production workflows. Worked with product partners.",
      },
      {
        company: "Babbage Events",
        title: "Event Coordinator",
        description: "Organized local community events.",
      },
    ],
    education: [],
    certifications: [],
    projects: [],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}
