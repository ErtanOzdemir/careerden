import type { DocumentContent, PersistenceUnitOfWork } from "@careerden/domain";
import { getActiveAccessibleJobApplication } from "@careerden/application";

export class UpdateDocumentContentUseCase {
  constructor(private readonly unitOfWork: PersistenceUnitOfWork) {}

  async execute(
    jobApplicationId: string,
    userId: string,
    documentContent: DocumentContent,
  ): Promise<DocumentContent> {
    return this.unitOfWork.execute(async ({ jobApplications, jobApplicationChanges, profiles }) => {
      const jobApplication = await getActiveAccessibleJobApplication(
        jobApplications,
        profiles,
        jobApplicationId,
        userId,
      );
      await jobApplications.saveDocumentContent(jobApplicationId, documentContent);
      await jobApplicationChanges.changed(jobApplication.id, jobApplication.profileId);
      return documentContent;
    });
  }
}
