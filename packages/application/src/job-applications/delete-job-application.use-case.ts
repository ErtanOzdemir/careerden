import type { PersistenceUnitOfWork } from "@link2cv/domain";
import { enqueueStorageDeletions } from "../storage/enqueue-storage-deletions.js";
import { getAccessibleJobApplication } from "./job-application-access.js";

export class DeleteJobApplicationUseCase {
  constructor(private readonly unitOfWork: PersistenceUnitOfWork) {}

  async execute(jobApplicationId: string, userId: string): Promise<void> {
    await this.unitOfWork.execute(
      async ({ jobApplications, jobApplicationChanges, outbox, profiles }) => {
        const jobApplication = await getAccessibleJobApplication(
          jobApplications,
          profiles,
          jobApplicationId,
          userId,
        );

        const [documents, companyLogoFileId] = await Promise.all([
          jobApplications.listGeneratedDocuments(jobApplicationId),
          jobApplications.getCompanyLogoFileId(jobApplicationId),
        ]);
        const fileIds = new Set(documents.map((document) => document.fileId));

        if (companyLogoFileId) fileIds.add(companyLogoFileId);

        await jobApplications.deleteById(jobApplicationId);
        await enqueueStorageDeletions(outbox, fileIds);
        await jobApplicationChanges.deleted(jobApplication.id, jobApplication.profileId);
      },
    );
  }
}
