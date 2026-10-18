import type { AiProvider, DocumentContent, ScrapeBundle } from "@careerden/domain";
import { richDocumentFromText } from "@careerden/domain";
import { describe, expect, it, vi } from "vitest";
import {
  createActiveTestSubscription,
  createBillingSubscriptionsDouble,
  createJobApplicationRepository,
  createProfiles,
  createTestJobApplication,
} from "@careerden/application/testing";
import { RewriteCoverLetterUseCase } from "./rewrite-cover-letter.use-case.js";

const draft: DocumentContent = {
  coverLetterContent: richDocumentFromText("Dear hiring team, I am applying."),
  customizedSummary: richDocumentFromText("Engineer shipping TypeScript services."),
  experienceEnhancements: [
    { experienceIndex: 0, description: richDocumentFromText("Built billing APIs with Node.js.") },
  ],
  skillSuggestions: ["TypeScript", "Node.js"],
  certificationSuggestions: [],
};

describe("RewriteCoverLetterUseCase", () => {
  it("writes the letter from the edited CV draft rather than the saved profile", async () => {
    const aiProvider = createAiProvider({
      paragraphs: ["Dear hiring team,", " I build billing APIs with Node.js. ", ""],
    });

    const result = await createUseCase(aiProvider).execute("job-1", "user-1", {
      documentContent: draft,
    });

    expect(result).toEqual({
      version: 1,
      blocks: [
        { type: "paragraph", children: [{ type: "text", text: "Dear hiring team," }] },
        {
          type: "paragraph",
          children: [{ type: "text", text: "I build billing APIs with Node.js." }],
        },
      ],
    });
    const prompt = JSON.parse(vi.mocked(aiProvider.generate).mock.calls[0]![0].prompt) as {
      tailoredCv: { summary: string; skills: string[]; experience: Array<{ description: string }> };
      currentCoverLetter: string;
    };
    expect(prompt.tailoredCv.summary).toBe("Engineer shipping TypeScript services.");
    expect(prompt.tailoredCv.skills).toEqual(["TypeScript", "Node.js"]);
    expect(prompt.tailoredCv.experience[0]?.description).toBe("Built billing APIs with Node.js.");
    expect(prompt.currentCoverLetter).toBe("Dear hiring team, I am applying.");
  });

  it("removes duration claims the profile does not support", async () => {
    const result = await createUseCase(
      createAiProvider({
        paragraphs: ["I bring 12 years of TypeScript experience. I build billing APIs."],
      }),
    ).execute("job-1", "user-1", { documentContent: draft });

    expect(JSON.stringify(result)).not.toContain("12 years");
  });

  it("rejects an empty rewrite instead of returning a blank letter", async () => {
    await expect(
      createUseCase(createAiProvider({ paragraphs: [" "] })).execute("job-1", "user-1", {
        documentContent: draft,
      }),
    ).rejects.toThrow("usable cover letter");
  });

  it("uses the premium tier for subscribers and the free tier otherwise", async () => {
    const aiProvider = createAiProvider({ paragraphs: ["Dear hiring team, I build APIs."] });
    const subscriptions = createBillingSubscriptionsDouble(createActiveTestSubscription());
    await createUseCase(aiProvider, subscriptions).execute("job-1", "user-1", { documentContent: draft });
    await createUseCase(aiProvider).execute("job-1", "user-1", { documentContent: draft });

    expect(subscriptions.findByUserId).toHaveBeenCalledWith("user-1");
    expect(vi.mocked(aiProvider.generate).mock.calls.map(([params]) => params.tier)).toEqual([
      "premium",
      "free",
    ]);
  });
});

function createUseCase(
  aiProvider: AiProvider,
  subscriptions = createBillingSubscriptionsDouble(),
) {
  const repository = createJobApplicationRepository({
    findById: vi.fn(async () => createTestJobApplication()),
    getScrapeBundle: vi.fn(
      async () =>
        ({
          job: {
            title: "Backend Engineer",
            companyName: "Example Inc",
            requirements: ["Build TypeScript services"],
          },
        }) as ScrapeBundle,
    ),
  });
  return new RewriteCoverLetterUseCase(
    repository,
    createProfiles() as never,
    aiProvider,
    subscriptions,
  );
}

function createAiProvider(output: unknown): AiProvider {
  return { generate: vi.fn(async () => output) } as unknown as AiProvider;
}
