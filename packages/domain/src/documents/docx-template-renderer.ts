import type { DocumentTemplate } from "./document-template.js";

export interface DocxTemplateRenderer {
  extractPlaceholders(template: Buffer): Promise<string[]>;
  render(input: {
    template: DocumentTemplate;
    templateBody: Buffer;
    data: Record<string, unknown>;
  }): Promise<Buffer>;
}
