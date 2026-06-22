import { describe, expect, it } from "vitest";
import { InMemoryJobApplicationRepository } from "@link2cv/infrastructure";
import { richDocumentFromText } from "@link2cv/domain";
import { UpdateDocumentContentUseCase } from "./update-document-content.js";

describe("UpdateDocumentContentUseCase", () => {
  it("replaces document content for an existing application", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const job = await repository.create({ profileId: "profile-1" });
    const useCase = new UpdateDocumentContentUseCase(repository);
    const documentContent = {
      customizedSummary: richDocumentFromText("User-edited summary"),
      experienceEnhancements: [],
    };

    const result = await useCase.execute(job.id, documentContent);

    expect(result).toEqual(documentContent);
    expect(await repository.getDocumentContent(job.id)).toEqual(documentContent);
  });

  it("returns null when the application does not exist", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const useCase = new UpdateDocumentContentUseCase(repository);

    expect(
      await useCase.execute("missing", {
        customizedSummary: richDocumentFromText("Summary"),
        experienceEnhancements: [],
      }),
    ).toBeNull();
  });
});
