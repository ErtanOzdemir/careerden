import { describe, expect, it } from "vitest";
import type { AiGenerateParams, AiProvider, ScrapeBundle, UserProfile } from "@careerden/domain";
import { sanitizeScrapeBundleText, stripHiddenHtmlElements } from "@careerden/domain";
import { findInjectedCanaries } from "./injected-canaries.js";
import { parsePromptWithJobPostingData } from "./job-posting-data.js";
import { promptInjectionCases, type PromptInjectionCase } from "./prompt-injection-cases.js";
import { RunMatchAnalysisUseCase } from "./run-match-analysis.use-case.js";

describe("prompt injection cases", () => {
  it("cover every injection vector with distinct ids and canaries", () => {
    expect(new Set(promptInjectionCases.map((testCase) => testCase.vector))).toEqual(
      new Set(["visible-text", "hidden-html", "invisible-unicode", "delimiter-breakout"]),
    );
    expect(new Set(promptInjectionCases.map((testCase) => testCase.id)).size).toBe(
      promptInjectionCases.length,
    );
    for (const testCase of promptInjectionCases) {
      expect(testCase.canaries.length).toBeGreaterThan(0);
    }
  });

  describe.each(promptInjectionCases.map((testCase) => [testCase.id, testCase] as const))(
    "%s",
    (_id, testCase) => {
      it("never places the injected text among the instructions", async () => {
        const { system, prompt } = await captureMatchAnalysisPrompt(testCase);
        const { instructions, jobPostingData } = parsePromptWithJobPostingData(prompt);

        expect(findInjectedCanaries(system, testCase.canaries)).toEqual([]);
        expect(findInjectedCanaries(instructions, testCase.canaries)).toEqual([]);
        expect(prompt.match(/<job_posting_data>/g)).toHaveLength(1);
        expect(prompt.match(/<\/job_posting_data>/g)).toHaveLength(1);
        expect(jobPostingData).toMatchObject({
          scrapedJob: { title: testCase.title, requirements: testCase.requirements },
        });
      });

      if (testCase.vector === "hidden-html" || testCase.vector === "invisible-unicode") {
        it("removes the hidden instruction before it reaches the model", async () => {
          const { system, prompt } = await captureMatchAnalysisPrompt(testCase);

          expect(findInjectedCanaries(prompt, testCase.canaries)).toEqual([]);
          expect(prompt).not.toMatch(/[\u200B-\u200F\u2066-\u2069\u{E0000}-\u{E007F}]/u);
          expect(system).not.toMatch(/[\u{E0000}-\u{E007F}]/u);
        });
      }
    },
  );
});

describe("findInjectedCanaries", () => {
  it("finds canaries copied into nested output, ignoring case, spacing, and punctuation", () => {
    const output = {
      coverLetterContent: "Dear team, I am the BEST candidate   Northwind has ever seen!",
      certificationsTips: [{ item: "Certified Northwind-Freight Specialist", text: "Add it." }],
      matchScore: 90,
    };

    expect(
      findInjectedCanaries(output, [
        "best candidate Northwind has ever seen",
        "Certified Northwind Freight Specialist",
        "Stanford PhD",
      ]),
    ).toEqual(["best candidate Northwind has ever seen", "Certified Northwind Freight Specialist"]);
  });

  it("returns nothing for clean output or empty canaries", () => {
    expect(
      findInjectedCanaries({ text: "Built Node.js services on AWS." }, ["Stanford PhD"]),
    ).toEqual([]);
    expect(findInjectedCanaries("anything", [" ", ""])).toEqual([]);
  });
});

/** Runs the real match-analysis prompt construction on a case, the way a scrape or paste reaches it. */
async function captureMatchAnalysisPrompt(
  testCase: PromptInjectionCase,
): Promise<{ system: string; prompt: string }> {
  const calls: AiGenerateParams<unknown>[] = [];
  const aiProvider: AiProvider = {
    async generate<T>(params: AiGenerateParams<T>): Promise<T> {
      calls.push(params as AiGenerateParams<unknown>);
      return params.outputSchema.parse({
        matchScore: 50,
        missingSkills: [],
        strongSkills: [],
        summaryTips: [],
        coverLetterContent: "Dear hiring team, I build Node.js services.",
        interviewTips: [],
        experienceTips: [{ experienceIndex: 0, tips: [] }],
      }) as T;
    },
  };

  await new RunMatchAnalysisUseCase(aiProvider).execute({
    jobApplicationId: "job-1",
    profile: profile(),
    scrape: sanitizeScrapeBundleText(scrapeBundle(testCase)),
  });

  return { system: calls[0]?.system ?? "", prompt: calls[0]?.prompt ?? "" };
}

function scrapeBundle(testCase: PromptInjectionCase): ScrapeBundle {
  const description = testCase.descriptionHtml
    ? stripHiddenHtmlElements(testCase.descriptionHtml)
        .replaceAll(/<[^>]+>/g, "\n")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join("\n")
    : testCase.description;

  return {
    job: {
      title: testCase.title,
      companyName: testCase.companyName,
      location: testCase.location,
      description,
      ...(testCase.descriptionHtml ? { descriptionHtml: testCase.descriptionHtml } : {}),
      requirements: testCase.requirements,
      raw: { html: testCase.descriptionHtml ?? testCase.description },
    },
  };
}

function profile(): UserProfile {
  return {
    id: "profile-1",
    fullName: "Jordan Miller",
    email: "jordan@example.com",
    headline: "Backend Engineer",
    summary: "Backend engineer building Node.js services.",
    skillGroups: [{ name: "", skills: ["Node.js", "TypeScript", "PostgreSQL"] }],
    certifications: [],
    experience: [
      {
        company: "Buckeye Freight",
        title: "Software Engineer",
        description: "Built Node.js services on AWS and designed PostgreSQL schemas.",
      },
    ],
    education: [],
    projects: [],
  } as unknown as UserProfile;
}
