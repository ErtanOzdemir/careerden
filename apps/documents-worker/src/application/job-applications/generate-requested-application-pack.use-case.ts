import type { ApplicationPackGenerationQueuePayload } from "../../domain/job-applications/application-pack-generation.queue.js";
import type {
  JobApplicationRepository,
  PersistenceUnitOfWork,
  UserProfileRepository,
} from "@careerden/domain";
import type { GenerateDocumentsUseCase } from "@careerden/application";
import { generatedDocumentFileIds } from "@careerden/application";
import { enqueueStorageDeletions } from "@careerden/application";

export class GenerateRequestedApplicationPackUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileRepository,
    private readonly documentGeneration: GenerateDocumentsUseCase,
    private readonly unitOfWork: PersistenceUnitOfWork,
  ) {}

  async execute(payload: ApplicationPackGenerationQueuePayload): Promise<void> {
    const jobApplication = await this.jobApplications.findById(payload.jobApplicationId);

    if (
      !jobApplication ||
      jobApplication.status !== "generating_documents" ||
      jobApplication.documentGenerationAttemptId !== payload.generationAttemptId
    ) {
      return;
    }

    const profile = await this.profiles.findById(jobApplication.profileId);
    if (!profile) throw new Error(`Profile ${jobApplication.profileId} was not found`);

    const analysis = await this.jobApplications.getMatchAnalysis(jobApplication.id);
    if (!analysis) {
      throw new Error(`Job application ${jobApplication.id} does not have completed AI analysis`);
    }

    const [documentContent, previousDocuments] = await Promise.all([
      this.jobApplications.getDocumentContent(jobApplication.id),
      this.jobApplications.listGeneratedDocuments(jobApplication.id),
    ]);

    let uploads: Awaited<ReturnType<GenerateDocumentsUseCase["stage"]>> = [];
    try {
      uploads = await this.documentGeneration.stage({
        jobApplicationId: jobApplication.id,
        generationAttemptId: payload.generationAttemptId,
        jobApplication,
        profile,
        analysis,
        ...(documentContent ? { documentContent } : {}),
      });

      await this.unitOfWork.execute(async ({ jobApplications, jobApplicationChanges, outbox }) => {
        if (
          !(await jobApplications.completeDocumentGeneration(
            jobApplication.id,
            payload.generationAttemptId,
          ))
        ) {
          await enqueueStorageDeletions(
            outbox,
            uploads.map((upload) => upload.fileId),
          );
          return;
        }

        await jobApplications.replaceGeneratedDocuments(jobApplication.id, uploads);
        await enqueueStorageDeletions(
          outbox,
          previousDocuments
            .map((document) => document.fileId)
            .filter((fileId) => !uploads.some((upload) => upload.fileId === fileId)),
        );
        await jobApplications.addEvent({
          jobApplicationId: jobApplication.id,
          type: "processing",
          title: "Application pack generation completed",
          metadata: { generationAttemptId: payload.generationAttemptId },
        });
        await jobApplicationChanges.changed(jobApplication.id, jobApplication.profileId);
      });
    } catch (error) {
      await this.unitOfWork.execute(({ outbox }) =>
        enqueueStorageDeletions(
          outbox,
          uploads.length > 0
            ? uploads.map((upload) => upload.fileId)
            : generatedDocumentFileIds(jobApplication.id, payload.generationAttemptId),
        ),
      );
      throw error;
    }
  }
}
