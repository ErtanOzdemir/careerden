import type {
  DocumentTemplate,
  DocumentTemplateField,
  DocxTemplateRenderer,
  FileStorage,
  UserProfileAccountRepository,
} from "@link2cv/domain";
import { ApplicationError } from "../application-error.js";
import { getAccessibleDocumentTemplate } from "./document-template-access.js";
import { hasValidCoverLetterContentMapping } from "./document-template-mapping.js";

export class UpdateDocumentTemplateMappingsUseCase {
  constructor(
    private readonly profiles: UserProfileAccountRepository,
    private readonly storage: FileStorage,
    private readonly docxTemplates: DocxTemplateRenderer,
  ) {}

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

    const mappedFields = Object.values(fieldMappings);
    const coverLetterContentMappings = mappedFields.filter(
      (field) => field === "cover_letter_content",
    );
    if (template.kind === "cover_letter" && coverLetterContentMappings.length !== 1) {
      throw new ApplicationError(
        "validation",
        "Cover letter templates must map one placeholder to cover letter content",
      );
    }

    if (template.kind === "cover_letter") {
      const contentPlaceholder = Object.entries(fieldMappings).find(
        ([, field]) => field === "cover_letter_content",
      )?.[0];
      const templateFile = await this.storage.get(template.fileId);

      if (
        !contentPlaceholder ||
        !(await this.docxTemplates.isPlaceholderStandalone(templateFile.body, contentPlaceholder))
      ) {
        throw new ApplicationError(
          "validation",
          `Cover letter Content placeholder "${contentPlaceholder ?? "unknown"}" must occupy its own paragraph in the DOCX template`,
        );
      }
    }

    if (template.kind === "cv" && mappedFields.includes("cover_letter_content")) {
      throw new ApplicationError(
        "validation",
        "CV templates cannot map the cover letter content field",
      );
    }

    const updated = await this.profiles.updateDocumentTemplateMappings(template.id, fieldMappings);
    if (!updated) throw new ApplicationError("not_found", "Document template not found");

    if (
      updated.kind === "cover_letter" &&
      !updated.isDefault &&
      hasValidCoverLetterContentMapping(updated) &&
      !(await this.profiles.findDefaultDocumentTemplate(profileId, "cover_letter"))
    ) {
      return (await this.profiles.setDefaultDocumentTemplate(profileId, updated.id)) ?? updated;
    }

    return updated;
  }
}
