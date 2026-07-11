import { describe, expect, it } from "vitest";
import { InMemoryJobApplicationRepository } from "@link2cv/infrastructure";
import { richDocumentFromText } from "@link2cv/domain";
import { UpdateDocumentContentUseCase } from "./update-document-content.use-case.js";
import { createProfiles, createUnitOfWork } from "./job-application-test-helpers.js";

describe("UpdateDocumentContentUseCase", () => {
  it("replaces document content for an existing application", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const job = await repository.create({ profileId: "profile-1" });
    const { unitOfWork, addOutboxEvent } = createUnitOfWork(repository, createProfiles());
    const useCase = new UpdateDocumentContentUseCase(unitOfWork);
    const documentContent = {
      customizedSummary: richDocumentFromText("User-edited summary"),
      experienceEnhancements: [],
    };

    const result = await useCase.execute(job.id, "user-1", documentContent);

    expect(result).toEqual(documentContent);
    expect(await repository.getDocumentContent(job.id)).toEqual(documentContent);
    expect(addOutboxEvent).toHaveBeenCalledOnce();
  });

  it("reports when the application does not exist", async () => {
    const repository = new InMemoryJobApplicationRepository();
    const { unitOfWork, addOutboxEvent } = createUnitOfWork(repository, createProfiles());
    const useCase = new UpdateDocumentContentUseCase(unitOfWork);

    await expect(
      useCase.execute("missing", "user-1", {
        customizedSummary: richDocumentFromText("Summary"),
        experienceEnhancements: [],
      }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(addOutboxEvent).not.toHaveBeenCalled();
  });
});
