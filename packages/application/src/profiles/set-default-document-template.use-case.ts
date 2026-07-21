import type { DocumentTemplate, UserProfileAccountRepository } from "@careerden/domain";
import { ApplicationError } from "../application-error.js";
import { getAccessibleDocumentTemplate } from "./document-template-access.js";
import { hasValidCoverLetterContentMapping } from "./document-template-mapping.js";

export class SetDefaultDocumentTemplateUseCase {
  constructor(private readonly profiles: UserProfileAccountRepository) {}

  async execute(profileId: string, templateId: string, userId: string): Promise<DocumentTemplate> {
    const accessible = await getAccessibleDocumentTemplate(
      this.profiles,
      profileId,
      templateId,
      userId,
    );
    if (accessible.kind === "cover_letter" && !hasValidCoverLetterContentMapping(accessible)) {
      throw new ApplicationError(
        "validation",
        "Map a cover letter content placeholder before setting this template as default",
      );
    }
    const template = await this.profiles.setDefaultDocumentTemplate(profileId, templateId);
    if (!template) throw new ApplicationError("not_found", "Document template not found");
    return template;
  }
}
