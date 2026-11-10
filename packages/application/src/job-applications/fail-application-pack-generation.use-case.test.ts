import { describe, expect, it, vi } from "vitest";
import { outboxEventTypes, type ApplicationPackGenerationQueuePayload } from "@careerden/domain";
import { generatedDocumentFileIds } from "../documents/generate-documents.use-case.js";
import { FailApplicationPackGenerationUseCase } from "./fail-application-pack-generation.use-case.js";
import {
  createJobApplicationRepository,
  createTestJobApplication,
  createUnitOfWork,
} from "./job-application-test-helpers.js";

const payload: ApplicationPackGenerationQueuePayload = {
  jobApplicationId: "job-1",
  generationAttemptId: "attempt-1",
};

function storageDeletions(addOutboxEvent: ReturnType<typeof vi.fn>): unknown[] {
  return addOutboxEvent.mock.calls
    .map(([event]) => event as { type: string; aggregateId: string })
    .filter((event) => event.type === outboxEventTypes.storageDelete)
    .map((event) => event.aggregateId);
}

describe("FailApplicationPackGenerationUseCase", () => {
  it("fails the current attempt, records why, and removes its partial files", async () => {
    const job = createTestJobApplication();
    const repository = createJobApplicationRepository({ findById: vi.fn(async () => job) });
    const { unitOfWork, addOutboxEvent, recordChanged } = createUnitOfWork(repository);

    await new FailApplicationPackGenerationUseCase(unitOfWork).execute(payload, "Renderer crashed");

    expect(repository.failDocumentGeneration).toHaveBeenCalledWith(
      "job-1",
      "attempt-1",
      "Renderer crashed",
    );
    expect(repository.addEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        jobApplicationId: "job-1",
        title: "Application pack generation failed",
        body: "Renderer crashed",
        metadata: { generationAttemptId: "attempt-1" },
      }),
    );
    expect(storageDeletions(addOutboxEvent)).toEqual(
      generatedDocumentFileIds("job-1", "attempt-1"),
    );
    expect(recordChanged).toHaveBeenCalledWith(job.id, job.profileId);
  });

  it("only cleans up files when the attempt is no longer current", async () => {
    const repository = createJobApplicationRepository({
      findById: vi.fn(async () => createTestJobApplication()),
      failDocumentGeneration: vi.fn(async () => false),
    });
    const { unitOfWork, addOutboxEvent, recordChanged } = createUnitOfWork(repository);

    await new FailApplicationPackGenerationUseCase(unitOfWork).execute(payload, "Late");

    expect(storageDeletions(addOutboxEvent)).toHaveLength(4);
    expect(repository.addEvent).not.toHaveBeenCalled();
    expect(recordChanged).not.toHaveBeenCalled();
  });

  it("only cleans up files when the job application was deleted", async () => {
    const repository = createJobApplicationRepository({ findById: vi.fn(async () => null) });
    const { unitOfWork, addOutboxEvent } = createUnitOfWork(repository);

    await new FailApplicationPackGenerationUseCase(unitOfWork).execute(payload, "Gone");

    expect(storageDeletions(addOutboxEvent)).toHaveLength(4);
    expect(repository.failDocumentGeneration).not.toHaveBeenCalled();
  });
});
