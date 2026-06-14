export type GeneratedDocumentKind = "cv" | "cover_letter";

export interface GeneratedDocument {
  id: string;
  jobApplicationId: string;
  kind: GeneratedDocumentKind;
  fileId: string;
  fileName: string;
  contentType: "application/pdf";
  createdAt: Date;
}
