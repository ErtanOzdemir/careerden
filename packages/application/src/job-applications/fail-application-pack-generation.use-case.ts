import type { ApplicationPackGenerationQueuePayload, PersistenceUnitOfWork } from "@link2cv/domain";
import { generatedDocumentFileIds } from "../documents/generate-documents.use-case.js";
import { enqueueStorageDeletions } from "../storage/enqueue-storage-deletions.js";

export class FailApplicationPackGenerationUseCase {
  constructor(private readonly unitOfWork: PersistenceUnitOfWork) {}

  async execute(payload: ApplicationPackGenerationQueuePayload, reason: string): Promise<void> {
    await this.unitOfWork.execute(async ({ jobApplications, jobApplicationChanges, outbox }) => {
      const jobApplication = await jobApplications.findById(payload.jobApplicationId);
      await enqueueStorageDeletions(
        outbox,
        generatedDocumentFileIds(payload.jobApplicationId, payload.generationAttemptId),
      );
      if (
        !jobApplication ||
        !(await jobApplications.failDocumentGeneration(
          payload.jobApplicationId,
          payload.generationAttemptId,
          reason,
        ))
      ) {
        return;
      }

      await jobApplications.addEvent({
        jobApplicationId: payload.jobApplicationId,
        type: "processing",
        title: "Application pack generation failed",
        body: reason,
        metadata: { generationAttemptId: payload.generationAttemptId },
      });
      await jobApplicationChanges.changed(jobApplication.id, jobApplication.profileId);
    });
  }
}
