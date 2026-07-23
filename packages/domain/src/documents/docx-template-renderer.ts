import type { DocumentTemplate } from "./document-template.js";

export class InvalidDocxTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDocxTemplateError";
  }
}

export interface DocxTemplateRenderer {
  extractPlaceholders(template: Buffer): Promise<string[]>;
  isPlaceholderStandalone(template: Buffer, placeholder: string): Promise<boolean>;
  render(input: {
    template: DocumentTemplate;
    templateBody: Buffer;
    data: Record<string, unknown>;
  }): Promise<Buffer>;
}
