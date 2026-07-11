import type {
  DocumentTemplate,
  DocxTemplateRenderer,
  FileStorage,
  UserProfileAccountRepository,
} from "@link2cv/domain";
import { ApplicationError } from "../application-error.js";
import { getAccessibleProfile } from "./profile-access.js";

const docxContentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export interface UploadDocumentTemplateInput {
  profileId: string;
  userId: string;
  fileName: string;
  size: number;
  body: Buffer;
}

export class UploadDocumentTemplateUseCase {
  constructor(
    private readonly profiles: UserProfileAccountRepository,
    private readonly storage: FileStorage,
    private readonly docxTemplates: DocxTemplateRenderer,
  ) {}

  async execute(input: UploadDocumentTemplateInput): Promise<DocumentTemplate> {
    await getAccessibleProfile(this.profiles, input.profileId, input.userId);
    const placeholders = await this.docxTemplates.extractPlaceholders(input.body);

    if (placeholders.length === 0) {
      throw new ApplicationError(
        "validation",
        "DOCX template must include at least one {{placeholder_name}} field",
      );
    }

    const stored = await this.storage.put({
      fileName: input.fileName,
      contentType: docxContentType,
      body: input.body,
      metadata: { kind: "cv_template", profileId: input.profileId },
    });
    const existing = await this.profiles.listDocumentTemplates(input.profileId);

    return this.profiles.createDocumentTemplate({
      profileId: input.profileId,
      kind: "cv",
      format: "docx",
      fileId: stored.id,
      fileName: input.fileName,
      contentType: docxContentType,
      size: input.size,
      placeholders,
      isDefault: existing.length === 0,
    });
  }
}
