import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { TemplateRenderer } from "@link2cv/domain";
import { isRichDocument, renderRichDocumentToHtml } from "./rich-document-html.js";

export class HtmlTemplateRenderer implements TemplateRenderer {
  constructor(private readonly templateDir = join(import.meta.dirname, "templates")) {}

  async render(templateId: string, data: Record<string, unknown>): Promise<string> {
    const template = await readFile(join(this.templateDir, `${templateId}.html`), "utf8");

    return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_match, key: string) => {
      return stringifyTemplateValue(data[key]);
    });
  }
}

function stringifyTemplateValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  if (Array.isArray(value)) {
    return value
      .map((item) =>
        isRichDocument(item)
          ? `<li>${renderRichDocumentToHtml(item)}</li>`
          : `<li>${escapeHtml(stringifyPlainValue(item))}</li>`,
      )
      .join("");
  }

  if (isRichDocument(value)) {
    return renderRichDocumentToHtml(value);
  }

  return escapeHtml(stringifyPlainValue(value));
}

function stringifyPlainValue(value: unknown): string {
  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value);
  }

  return String(value);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
