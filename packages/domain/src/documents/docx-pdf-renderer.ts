export interface DocxPdfRenderer {
  docxToPdf(docx: Buffer): Promise<Buffer>;
}
