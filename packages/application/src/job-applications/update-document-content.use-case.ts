import type { DocumentContent, PersistenceUnitOfWork } from "@link2cv/domain";
import { getAccessibleJobApplication } from "./job-application-access.js";
import { enqueueJobApplicationChange } from "./enqueue-job-application-change.js";

export class UpdateDocumentContentUseCase {
  constructor(private readonly unitOfWork: PersistenceUnitOfWork) {}

  async execute(
    jobApplicationId: string,
    userId: string,
    documentContent: DocumentContent,
  ): Promise<DocumentContent> {
    return this.unitOfWork.execute(async ({ jobApplications, outbox, profiles }) => {
      const jobApplication = await getAccessibleJobApplication(
        jobApplications,
        profiles,
        jobApplicationId,
        userId,
      );
      await jobApplications.saveDocumentContent(jobApplicationId, documentContent);
      await enqueueJobApplicationChange(outbox, jobApplication.id, jobApplication.profileId);
      return documentContent;
    });
  }
}
