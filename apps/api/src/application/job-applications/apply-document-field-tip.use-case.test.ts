import type { AiProvider, RichDocument, ScrapeBundle } from "@careerden/domain";
import { describe, expect, it, vi } from "vitest";
import { ApplyDocumentFieldTipUseCase } from "./apply-document-field-tip.use-case.js";
import {
  createActiveTestSubscription,
  createBillingSubscriptionsDouble,
  createJobApplicationRepository,
  createProfiles,
  createTestJobApplication,
} from "@careerden/application/testing";

const bulletDescription: RichDocument = {
  version: 1,
  blocks: [
    {
      type: "bulletList",
      items: [
        { blocks: [paragraph("Built TypeScript APIs")] },
        { blocks: [paragraph("Cut build time by 30%")] },
      ],
    },
  ],
};

describe("ApplyDocumentFieldTipUseCase", () => {
  it("sends the field structure to the AI and returns bullets as a bullet list", async () => {
    const aiProvider = createAiProvider({
      blocks: [
        {
          kind: "bullets",
          lines: [
            "Built production TypeScript APIs with product partners",
            "Cut build time by 30%",
          ],
        },
      ],
    });

    const result = await createUseCase(aiProvider).execute("job-1", "user-1", {
      field: { type: "experience", index: 0 },
      currentValue: bulletDescription,
      tip: "Mention the product collaboration.",
    });

    expect(result).toEqual({
      version: 1,
      blocks: [
        {
          type: "bulletList",
          items: [
            { blocks: [paragraph("Built production TypeScript APIs with product partners")] },
            { blocks: [paragraph("Cut build time by 30%")] },
          ],
        },
      ],
    });
    const prompt = JSON.parse(vi.mocked(aiProvider.generate).mock.calls[0]![0].prompt) as {
      currentContent: unknown;
    };
    expect(prompt.currentContent).toEqual([
      { kind: "bullets", lines: ["Built TypeScript APIs", "Cut build time by 30%"] },
    ]);
    expect(vi.mocked(aiProvider.generate).mock.calls[0]![0].thinking).toBe(false);
  });

  it("forwards only requirement and evidence links that match the job and profile", async () => {
    const aiProvider = createAiProvider({ blocks: [{ kind: "bullets", lines: ["Revised"] }] });
    const useCase = createUseCase(aiProvider);

    await useCase.execute("job-1", "user-1", {
      field: { type: "experience", index: 0 },
      currentValue: bulletDescription,
      tip: "Mention the product collaboration.",
      requirement: "Build TypeScript services",
      evidence: "Software Engineer",
    });
    await useCase.execute("job-1", "user-1", {
      field: { type: "experience", index: 0 },
      currentValue: bulletDescription,
      tip: "Mention the product collaboration.",
      requirement: "Lead a platform team",
      evidence: "Led a team of 8 engineers",
    });

    const [verified, unverified] = vi
      .mocked(aiProvider.generate)
      .mock.calls.map(([params]) => JSON.parse(params.prompt) as Record<string, unknown>);
    expect(verified).toMatchObject({
      suggestions: [
        {
          tip: "Mention the product collaboration.",
          targetRequirement: "Build TypeScript services",
          profileEvidence: "Software Engineer",
        },
      ],
      tone: "professional",
    });
    expect(unverified).toMatchObject({
      suggestions: [{ tip: "Mention the product collaboration." }],
    });
    expect((unverified?.suggestions as object[])[0]).not.toHaveProperty("targetRequirement");
    expect((unverified?.suggestions as object[])[0]).not.toHaveProperty("profileEvidence");
  });

  it("applies additional tips and a candidate answer in one revision", async () => {
    const aiProvider = createAiProvider({ blocks: [{ kind: "bullets", lines: ["Revised"] }] });

    await createUseCase(aiProvider).execute("job-1", "user-1", {
      field: { type: "experience", index: 0 },
      currentValue: bulletDescription,
      tip: "Did you operate these services on Kubernetes?",
      additionalTips: [{ tip: "Lead with the TypeScript work.", evidence: "Software Engineer" }],
      candidateAnswer: "Yes, I ran our staging cluster on EKS.",
    });

    const prompt = JSON.parse(vi.mocked(aiProvider.generate).mock.calls[0]![0].prompt) as Record<
      string,
      unknown
    >;
    expect(prompt.suggestions).toEqual([
      { tip: "Did you operate these services on Kubernetes?" },
      { tip: "Lead with the TypeScript work.", profileEvidence: "Software Engineer" },
    ]);
    expect(prompt.candidateAnswer).toBe("Yes, I ran our staging cluster on EKS.");
  });

  it("keeps the current value when the AI returns no usable content", async () => {
    const result = await createUseCase(
      createAiProvider({ blocks: [{ kind: "bullets", lines: ["  "] }] }),
    ).execute("job-1", "user-1", {
      field: { type: "experience", index: 0 },
      currentValue: bulletDescription,
      tip: "Mention the product collaboration.",
    });

    expect(result).toBe(bulletDescription);
  });

  it("uses the premium tier for subscribers and the free tier otherwise", async () => {
    const aiProvider = createAiProvider({ blocks: [{ kind: "bullets", lines: ["Revised"] }] });
    const subscriptions = createBillingSubscriptionsDouble(createActiveTestSubscription());
    await createUseCase(aiProvider, subscriptions).execute("job-1", "user-1", {
        field: { type: "experience", index: 0 },
        currentValue: bulletDescription,
        tip: "Mention TypeScript",
      });
    await createUseCase(aiProvider).execute("job-1", "user-1", {
        field: { type: "experience", index: 0 },
        currentValue: bulletDescription,
        tip: "Mention TypeScript",
      });

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
          job: { title: "Backend Engineer", requirements: ["Build TypeScript services"] },
        }) as ScrapeBundle,
    ),
  });
  return new ApplyDocumentFieldTipUseCase(
    repository,
    createProfiles() as never,
    aiProvider,
    subscriptions,
  );
}

function createAiProvider(output: unknown): AiProvider {
  return { generate: vi.fn(async () => output) } as unknown as AiProvider;
}

function paragraph(text: string) {
  return { type: "paragraph" as const, children: [{ type: "text" as const, text }] };
}
