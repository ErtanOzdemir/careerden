import type {
  DocumentTemplate,
  DocumentTemplateVariableAliases,
  UserProfileAccountRepository,
} from "@link2cv/domain";
import { ApplicationError } from "../application-error.js";
import { getAccessibleDocumentTemplate } from "./document-template-access.js";

export class UpdateDocumentTemplateVariableAliasesUseCase {
  constructor(private readonly profiles: UserProfileAccountRepository) {}

  async execute(
    profileId: string,
    templateId: string,
    userId: string,
    variableAliases: DocumentTemplateVariableAliases,
  ): Promise<DocumentTemplate> {
    const template = await getAccessibleDocumentTemplate(
      this.profiles,
      profileId,
      templateId,
      userId,
    );
    if (variableAliases.fields.cover_letter_content) {
      throw new ApplicationError(
        "validation",
        "Cover letter content must be configured through placeholder mappings",
      );
    }
    const updated = await this.profiles.updateDocumentTemplateVariableAliases(
      template.id,
      variableAliases,
    );
    if (!updated) throw new ApplicationError("not_found", "Document template not found");
    return updated;
  }
}
