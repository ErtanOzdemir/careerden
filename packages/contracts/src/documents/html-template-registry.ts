import { isRichDocument, renderRichDocumentToHtml } from "./rich-document-html.js";
import { cvDefaultHtml } from "./templates/cv-default.js";
import { coverLetterDefaultHtml } from "./templates/cover-letter-default.js";

export type DocumentTemplateKind = "cv" | "cover_letter";

export interface HtmlTemplateDefinition {
  id: string;
  kind: DocumentTemplateKind;
  name: string;
  description?: string;
  html: string;
}

export const HTML_TEMPLATES: HtmlTemplateDefinition[] = [
  {
    id: "cv.default",
    kind: "cv",
    name: "Classic",
    description: "A clean, single-column CV layout.",
    html: cvDefaultHtml,
  },
  {
    id: "cover-letter.default",
    kind: "cover_letter",
    name: "Classic",
    description: "A simple, letter-style cover letter layout.",
    html: coverLetterDefaultHtml,
  },
];

export function listHtmlTemplates(kind: DocumentTemplateKind): HtmlTemplateDefinition[] {
  return HTML_TEMPLATES.filter((template) => template.kind === kind);
}

export function getHtmlTemplateById(id: string): HtmlTemplateDefinition | undefined {
  return HTML_TEMPLATES.find((template) => template.id === id);
}

/**
 * Pure, Node-free mustache-lite substitution: `{{#section}}...{{/section}}` renders its body only
 * when `data[section]` is truthy, and `{{field}}` interpolates a value. Being dependency-free lets
 * `apps/web` render real template markup instantly in the browser instead of only on the server.
 */
export function renderHtmlTemplate(templateId: string, data: Record<string, unknown>): string {
  const template = getHtmlTemplateById(templateId);
  if (!template) {
    throw new Error(`Unknown HTML template: ${templateId}`);
  }

  const withConditionalSections = template.html.replace(
    /\{\{#([a-zA-Z0-9_]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
    (_match, key: string, body: string) => (hasTemplateValue(data[key]) ? body : ""),
  );

  return withConditionalSections.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_match, key: string) => {
    return stringifyTemplateValue(data[key]);
  });
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
