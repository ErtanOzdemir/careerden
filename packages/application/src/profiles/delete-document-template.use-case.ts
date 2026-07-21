import type { PersistenceUnitOfWork } from "@careerden/domain";
import { ApplicationError } from "../application-error.js";
import { enqueueStorageDeletions } from "../storage/enqueue-storage-deletions.js";
import { getAccessibleDocumentTemplate } from "./document-template-access.js";

export class DeleteDocumentTemplateUseCase {
  constructor(private readonly unitOfWork: PersistenceUnitOfWork) {}

  async execute(profileId: string, templateId: string, userId: string): Promise<void> {
    await this.unitOfWork.execute(
      async ({ jobApplications, jobApplicationChanges, outbox, profiles }) => {
        const template = await getAccessibleDocumentTemplate(
          profiles,
          profileId,
          templateId,
          userId,
        );
        const deleted = await profiles.deleteDocumentTemplate(template.id);

        if (!deleted) {
          throw new ApplicationError("not_found", "Document template not found");
        }

        const affectedApplicationIds = await jobApplications.clearApplicationPackTemplateSelection(
          profileId,
          template.kind,
          template.id,
        );

        await enqueueStorageDeletions(outbox, [template.fileId]);
        await Promise.all(
          affectedApplicationIds.map((applicationId) =>
            jobApplicationChanges.changed(applicationId, profileId),
          ),
        );
      },
    );
  }
}
