import type {
  DocumentTemplate,
  DocumentTemplateKind,
  DocxTemplateRenderer,
  FileStorage,
  PersistenceUnitOfWork,
  UserProfileAccountRepository,
} from "@link2cv/domain";
import { ApplicationError } from "../application-error.js";
import { enqueueStorageDeletions } from "../storage/enqueue-storage-deletions.js";
import { randomUUID } from "node:crypto";
import { getAccessibleProfile } from "./profile-access.js";

const docxContentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export interface UploadDocumentTemplateInput {
  kind: DocumentTemplateKind;
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
    private readonly unitOfWork: PersistenceUnitOfWork,
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

    const templateId = randomUUID();
    const stored = await this.storage.put({
      key: `profiles/${input.profileId}/document-templates/${templateId}/${safeFileName(input.fileName)}`,
      fileName: input.fileName,
      contentType: docxContentType,
      body: input.body,
      metadata: { kind: `${input.kind}_template`, profileId: input.profileId },
    });
    try {
      return await this.unitOfWork.execute(async ({ profiles }) => {
        await getAccessibleProfile(profiles, input.profileId, input.userId);
        const existing = await profiles.listDocumentTemplates(input.profileId);
        return profiles.createDocumentTemplate({
          profileId: input.profileId,
          kind: input.kind,
          format: "docx",
          fileId: stored.id,
          fileName: input.fileName,
          contentType: docxContentType,
          size: input.size,
          placeholders,
          isDefault:
            input.kind === "cv" && existing.every((template) => template.kind !== input.kind),
        });
      });
    } catch (error) {
      await this.unitOfWork.execute(({ outbox }) => enqueueStorageDeletions(outbox, [stored.id]));
      throw error;
    }
  }
}

function safeFileName(fileName: string): string {
  return fileName.replaceAll(/[^a-zA-Z0-9._-]/g, "-") || "template.docx";
}
