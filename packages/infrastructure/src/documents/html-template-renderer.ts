import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { TemplateRenderer } from "@link2cv/domain";
import { isRichDocument, renderRichDocumentToHtml } from "./rich-document-html.js";

export class HtmlTemplateRenderer implements TemplateRenderer {
  constructor(private readonly templateDir = join(import.meta.dirname, "templates")) {}

  async render(templateId: string, data: Record<string, unknown>): Promise<string> {
    const template = await readFile(join(this.templateDir, `${templateId}.html`), "utf8");
    const withConditionalSections = template.replace(
      /\{\{#([a-zA-Z0-9_]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
      (_match, key: string, body: string) => (hasTemplateValue(data[key]) ? body : ""),
    );

    return withConditionalSections.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_match, key: string) => {
      return stringifyTemplateValue(data[key]);
    });
  }
}

function stringifyTemplateValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.map((item) => `<li>${stringifyStructuredValue(item)}</li>`).join("");
  }

  if (isRichDocument(value)) {
    return renderRichDocumentToHtml(value);
  }

  if (typeof value === "object") {
    return stringifyStructuredObject(value as Record<string, unknown>);
  }

  return escapeHtml(stringifyPlainValue(value));
}

function stringifyPlainValue(value: unknown): string {
  return String(value);
}

function stringifyStructuredValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (isRichDocument(value)) return renderRichDocumentToHtml(value);
  if (Array.isArray(value)) {
    return `<ul>${value.map((item) => `<li>${stringifyStructuredValue(item)}</li>`).join("")}</ul>`;
  }
  if (typeof value === "object") {
    return stringifyStructuredObject(value as Record<string, unknown>);
  }
  return escapeHtml(stringifyPlainValue(value));
}

function stringifyStructuredObject(value: Record<string, unknown>): string {
  const rows = Object.entries(value)
    .filter(([, item]) => hasTemplateValue(item))
    .map(
      ([key, item]) =>
        `<div><dt>${escapeHtml(humanizeKey(key))}</dt><dd>${stringifyStructuredValue(item)}</dd></div>`,
    )
    .join("");

  return rows ? `<dl>${rows}</dl>` : "";
}

function hasTemplateValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (isRichDocument(value)) return value.blocks.length > 0;
  return true;
}

function humanizeKey(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
