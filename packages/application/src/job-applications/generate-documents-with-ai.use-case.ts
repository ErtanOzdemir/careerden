import type {
  DocumentPreferences,
  GeneratedDocument,
  JobApplicationRepository,
  PersistenceUnitOfWork,
  PremiumAiService,
  UserProfileRepository,
} from "@careerden/domain";
import { randomUUID } from "node:crypto";
import {
  generatedDocumentFileIds,
  type GenerateDocumentsUseCase,
} from "../documents/generate-documents.use-case.js";
import { enqueueStorageDeletions } from "../storage/enqueue-storage-deletions.js";

export class GenerateDocumentsWithAiUseCase {
  constructor(
    private readonly premiumAi: PremiumAiService,
    private readonly generateDocuments: GenerateDocumentsUseCase,
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileRepository,
    private readonly unitOfWork: PersistenceUnitOfWork,
  ) {}

  async execute(input: {
    jobApplicationId: string;
    preferences: DocumentPreferences;
  }): Promise<GeneratedDocument[]> {
    const jobApplication = await this.jobApplications.findById(input.jobApplicationId);

    if (!jobApplication) {
      throw new Error(`Job application ${input.jobApplicationId} was not found`);
    }

    const profile = await this.profiles.findById(jobApplication.profileId);

    if (!profile) {
      throw new Error(`Profile ${jobApplication.profileId} was not found`);
    }

    const scrape = await this.jobApplications.getScrapeBundle(input.jobApplicationId);

    if (!scrape) {
      throw new Error(`No scrape bundle found for job application ${input.jobApplicationId}`);
    }

    const attemptId = randomUUID();
    const previousDocuments = await this.jobApplications.listGeneratedDocuments(
      input.jobApplicationId,
    );
    const started = await this.unitOfWork.execute(
      async ({ jobApplications, jobApplicationChanges, outbox }) => {
        const result = await jobApplications.beginDocumentGeneration(
          input.jobApplicationId,
          attemptId,
        );
        if (!result.started) return false;
        if (result.supersededAttemptId) {
          await enqueueStorageDeletions(
            outbox,
            generatedDocumentFileIds(input.jobApplicationId, result.supersededAttemptId),
          );
        }
        await jobApplications.addEvent({
          jobApplicationId: input.jobApplicationId,
          type: "processing",
          title: "AI document generation started",
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
      const result = await this.premiumAi.generate({
        scrape,
        profile,
        preferences: input.preferences,
      });
      const uploads = await this.generateDocuments.stage({
        jobApplicationId: input.jobApplicationId,
        generationAttemptId: attemptId,
        jobApplication,
        profile,
        analysis: result.matchAnalysis,
        documentContent: result.documentContent,
      });
      const documents = await this.unitOfWork.execute(
        async ({ jobApplications, jobApplicationChanges, outbox }) => {
          if (
            !(await jobApplications.completeDocumentGeneration(input.jobApplicationId, attemptId))
          ) {
            await enqueueStorageDeletions(
              outbox,
              uploads.map((upload) => upload.fileId),
            );
            return null;
          }
          await jobApplications.saveMatchAnalysis(input.jobApplicationId, result.matchAnalysis);
          await jobApplications.saveDocumentContent(input.jobApplicationId, result.documentContent);
          const attached = await jobApplications.replaceGeneratedDocuments(
            input.jobApplicationId,
            uploads,
          );
          await enqueueStorageDeletions(
            outbox,
            previousDocuments
              .map((document) => document.fileId)
              .filter((fileId) => !uploads.some((upload) => upload.fileId === fileId)),
          );
          await jobApplications.addEvent({
            jobApplicationId: input.jobApplicationId,
            type: "processing",
            title: "AI document generation completed",
            metadata: {
              attemptId,
              matchScore: result.matchAnalysis.matchScore,
              creditsRemaining: result.creditsRemaining,
            },
          });
          await jobApplications.addEvent({
            jobApplicationId: input.jobApplicationId,
            type: "processing",
            title: "Documents generated",
            metadata: { attemptId },
          });
          await jobApplicationChanges.changed(jobApplication.id, jobApplication.profileId);
          return attached;
        },
      );
      if (!documents) throw new Error("Document generation was superseded by a newer attempt");
      return documents;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown document generation error";
      await this.unitOfWork.execute(async ({ jobApplications, jobApplicationChanges, outbox }) => {
        await enqueueStorageDeletions(
          outbox,
          generatedDocumentFileIds(input.jobApplicationId, attemptId),
        );
        if (
          !(await jobApplications.failDocumentGeneration(
            input.jobApplicationId,
            attemptId,
            message,
          ))
        ) {
          return;
        }
        await jobApplications.addEvent({
          jobApplicationId: input.jobApplicationId,
          type: "processing",
          title: "AI document generation failed",
          body: message,
          metadata: { attemptId },
        });
        await jobApplicationChanges.changed(jobApplication.id, jobApplication.profileId);
      });
      throw error;
    }
  }
}
