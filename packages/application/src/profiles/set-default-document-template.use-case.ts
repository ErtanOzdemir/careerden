import type { DocumentTemplate, UserProfileAccountRepository } from "@link2cv/domain";
import { ApplicationError } from "../application-error.js";
import { getAccessibleDocumentTemplate } from "./document-template-access.js";

export class SetDefaultDocumentTemplateUseCase {
  constructor(private readonly profiles: UserProfileAccountRepository) {}

  async execute(profileId: string, templateId: string, userId: string): Promise<DocumentTemplate> {
    await getAccessibleDocumentTemplate(this.profiles, profileId, templateId, userId);
    const template = await this.profiles.setDefaultDocumentTemplate(profileId, templateId);
    if (!template) throw new ApplicationError("not_found", "Document template not found");
    return template;
  }
}
