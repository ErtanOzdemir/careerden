export type GeneratedDocumentKind = "cv" | "cover_letter";
export type GeneratedDocumentFormat = "docx" | "pdf";

export interface GeneratedDocument {
  id: string;
  jobApplicationId: string;
  kind: GeneratedDocumentKind;
  format: GeneratedDocumentFormat;
  fileId: string;
  fileName: string;
  contentType: string;
  createdAt: Date;
}
