import type {
  GeneratedDocument,
  JobApplicationRepository,
  PersistenceUnitOfWork,
  UserProfileRepository,
} from "@careerden/domain";
import { randomUUID } from "node:crypto";
import { generatedDocumentFileIds, type GenerateDocumentsUseCase } from "@careerden/application";
import { enqueueStorageDeletions } from "@careerden/application";
import { assertJobApplicationActive } from "@careerden/application";

export class GenerateJobApplicationDocumentsUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileRepository,
    private readonly documentGeneration: GenerateDocumentsUseCase,
    private readonly unitOfWork: PersistenceUnitOfWork,
  ) {}

  async execute(jobApplicationId: string): Promise<GeneratedDocument[]> {
    const jobApplication = await this.jobApplications.findById(jobApplicationId);

    if (!jobApplication) {
      throw new Error(`Job application ${jobApplicationId} was not found`);
    }
    assertJobApplicationActive(jobApplication);

    const profile = await this.profiles.findById(jobApplication.profileId);

    if (!profile) {
      throw new Error(`Profile ${jobApplication.profileId} was not found`);
    }

    const analysis = await this.jobApplications.getMatchAnalysis(jobApplicationId);

    if (!analysis) {
      throw new Error(`Job application ${jobApplicationId} does not have AI analysis to approve`);
    }

    const documentContent = await this.jobApplications.getDocumentContent(jobApplicationId);

    const attemptId = randomUUID();
    const previousDocuments = await this.jobApplications.listGeneratedDocuments(jobApplicationId);
    const started = await this.unitOfWork.execute(
      async ({ jobApplications, jobApplicationChanges, outbox }) => {
        const result = await jobApplications.beginDocumentGeneration(jobApplicationId, attemptId);
        if (!result.started) return false;
        if (result.supersededAttemptId) {
          await enqueueStorageDeletions(
            outbox,
            generatedDocumentFileIds(jobApplicationId, result.supersededAttemptId),
          );
        }
        await jobApplications.addEvent({
          jobApplicationId,
          type: "processing",
          title: "Document generation approved",
          metadata: { attemptId },
        });
        await jobApplicationChanges.changed(jobApplication.id, jobApplication.profileId);
        return true;
      },
    );
    if (!started) {
      throw new Error(
        `Invalid job application status transition: ${jobApplication.status} -> generating_documents`,
      );
    }

    try {
      const uploads = await this.documentGeneration.stage({
        jobApplicationId,
        generationAttemptId: attemptId,
        jobApplication,
        profile,
        analysis,
        ...(documentContent ? { documentContent } : {}),
      });

      const generated = await this.unitOfWork.execute(
        async ({ jobApplications, jobApplicationChanges, outbox }) => {
          if (!(await jobApplications.completeDocumentGeneration(jobApplicationId, attemptId))) {
            await enqueueStorageDeletions(
              outbox,
              uploads.map((upload) => upload.fileId),
            );
            return null;
          }
          const attached = await jobApplications.replaceGeneratedDocuments(
            jobApplicationId,
            uploads,
          );
          await enqueueStorageDeletions(
            outbox,
            previousDocuments
              .map((document) => document.fileId)
              .filter((fileId) => !uploads.some((upload) => upload.fileId === fileId)),
          );
          await jobApplications.addEvent({
            jobApplicationId,
            type: "processing",
            title: "Document generation completed",
            metadata: { attemptId },
          });
          await jobApplicationChanges.changed(jobApplication.id, jobApplication.profileId);
          return attached;
        },
      );
      if (!generated) throw new Error("Document generation was superseded by a newer attempt");

      return generated;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown document generation error";
      await this.unitOfWork.execute(async ({ jobApplications, jobApplicationChanges, outbox }) => {
        await enqueueStorageDeletions(
          outbox,
          generatedDocumentFileIds(jobApplicationId, attemptId),
        );
        if (!(await jobApplications.failDocumentGeneration(jobApplicationId, attemptId, message))) {
          return;
        }
        await jobApplications.addEvent({
          jobApplicationId,
          type: "processing",
          title: "Document generation failed",
          body: message,
          metadata: { attemptId },
        });
        await jobApplicationChanges.changed(jobApplication.id, jobApplication.profileId);
      });
      throw error;
    }
  }
}
