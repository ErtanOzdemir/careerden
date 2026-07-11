import type {
  DocumentTemplate,
  DocumentTemplateField,
  UserProfileAccountRepository,
} from "@link2cv/domain";
import { ApplicationError } from "../application-error.js";
import { getAccessibleDocumentTemplate } from "./document-template-access.js";

export class UpdateDocumentTemplateMappingsUseCase {
  constructor(private readonly profiles: UserProfileAccountRepository) {}

  async execute(
    profileId: string,
    templateId: string,
    userId: string,
    fieldMappings: Record<string, DocumentTemplateField>,
  ): Promise<DocumentTemplate> {
    const template = await getAccessibleDocumentTemplate(
      this.profiles,
      profileId,
      templateId,
      userId,
    );
    const unknown = Object.keys(fieldMappings).filter(
      (placeholder) => !template.placeholders.includes(placeholder),
    );

    if (unknown.length > 0) {
      throw new ApplicationError(
        "validation",
        "Template mappings contain unknown placeholder keys",
        { unknown },
      );
    }

    const updated = await this.profiles.updateDocumentTemplateMappings(template.id, fieldMappings);
    if (!updated) throw new ApplicationError("not_found", "Document template not found");
    return updated;
  }
}
