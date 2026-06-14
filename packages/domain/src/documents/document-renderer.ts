export interface DocumentRenderer {
  htmlToPdf(html: string): Promise<Buffer>;
}
