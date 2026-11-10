import { describe, expect, it, vi } from "vitest";
import type { MatchAnalysisResult, UserProfileAccountRepository } from "@careerden/domain";
import type { GenerateDocumentsUseCase, PreviewGeneratedDocuments } from "@careerden/application";
import {
  createJobApplicationRepository,
  createProfiles,
  createTestJobApplication,
} from "@careerden/application/testing";
import { PreviewApplicationPackUseCase } from "./preview-application-pack.use-case.js";

function setup(analysis: MatchAnalysisResult | null = {} as MatchAnalysisResult) {
  const job = createTestJobApplication();
  const repository = createJobApplicationRepository({
    findById: vi.fn(async () => job),
    getMatchAnalysis: vi.fn(async () => analysis),
  });
  const profiles = createProfiles() as UserProfileAccountRepository;
  const preview = { cv: { html: "<p>cv</p>" } } as unknown as PreviewGeneratedDocuments;
  const documentGeneration = { preview: vi.fn(async () => preview) };
  const useCase = new PreviewApplicationPackUseCase(
    repository,
    profiles,
    documentGeneration as unknown as GenerateDocumentsUseCase,
  );

  return { job, documentGeneration, preview, useCase };
}

describe("PreviewApplicationPackUseCase", () => {
  it("renders draft preferences without persisting them", async () => {
    const { job, documentGeneration, preview, useCase } = setup();

    await expect(
      useCase.execute(job.id, "user-1", { preferences: { language: "de", tone: "concise" } }),
    ).resolves.toBe(preview);
    expect(documentGeneration.preview).toHaveBeenCalledWith(
      expect.objectContaining({
        jobApplicationId: job.id,
        jobApplication: expect.objectContaining({
          applicationPackPreferences: expect.objectContaining({ language: "de", tone: "concise" }),
        }),
      }),
    );
  });

  it("requires a completed analysis", async () => {
    const { job, documentGeneration, useCase } = setup(null);

    await expect(useCase.execute(job.id, "user-1", {})).rejects.toMatchObject({
      code: "validation",
    });
    expect(documentGeneration.preview).not.toHaveBeenCalled();
  });

  it("hides another user's job application", async () => {
    const { job, documentGeneration, useCase } = setup();

    await expect(useCase.execute(job.id, "user-2", {})).rejects.toMatchObject({
      code: "not_found",
    });
    expect(documentGeneration.preview).not.toHaveBeenCalled();
  });
});
