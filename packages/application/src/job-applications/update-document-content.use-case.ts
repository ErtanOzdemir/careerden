import type { DocumentContent, PersistenceUnitOfWork } from "@careerden/domain";
import { normalizeDescriptionOnlyDocumentContent } from "@careerden/domain";
import { ApplicationError } from "../application-error.js";
import { getActiveAccessibleJobApplication } from "./job-application-access.js";

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
      const profile = await profiles.findById(jobApplication.profileId);
      if (!profile) throw new ApplicationError("not_found", "Profile not found");
      const normalizedContent = normalizeDescriptionOnlyDocumentContent(profile, documentContent);
      await jobApplications.saveDocumentContent(jobApplicationId, normalizedContent);
      await jobApplicationChanges.changed(jobApplication.id, jobApplication.profileId);
      return normalizedContent;
    });
  }
}
