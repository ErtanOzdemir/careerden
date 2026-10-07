import type { ApplicationPackGenerationQueuePayload } from "../../domain/job-applications/application-pack-generation.queue.js";
import type { PersistenceUnitOfWork } from "@careerden/domain";
import { generatedDocumentFileIds } from "@careerden/application";
import { enqueueStorageDeletions } from "@careerden/application";

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
