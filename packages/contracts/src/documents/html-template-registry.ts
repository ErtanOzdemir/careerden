import { isRichDocument, renderRichDocumentToHtml } from "./rich-document-html.js";
import type { ProfileSkillGroup } from "../profiles/skill-groups.js";
import { hasNamedSkillGroups, UNCATEGORIZED_SKILL_GROUP_LABEL } from "../profiles/skill-groups.js";
import { cvDefaultHtml } from "./templates/cv-default.js";
import { cvEditorialHtml } from "./templates/cv-editorial.js";
import { cvLedgerHtml } from "./templates/cv-ledger.js";
import { cvMinimalHtml } from "./templates/cv-minimal.js";
import { cvModernHtml } from "./templates/cv-modern.js";
import { cvTechnicalHtml } from "./templates/cv-technical.js";
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
    id: "cv.editorial",
    kind: "cv",
    name: "Editorial",
    description: "Serif headings with a warm accent and right-aligned dates.",
    html: cvEditorialHtml,
  },
  {
    id: "cv.modern",
    kind: "cv",
    name: "Modern",
    description: "A bold header with dates in a left-hand column.",
    html: cvModernHtml,
  },
  {
    id: "cv.minimal",
    kind: "cv",
    name: "Minimal",
    description: "Monochrome, airy, and quiet.",
    html: cvMinimalHtml,
  },
  {
    id: "cv.technical",
    kind: "cv",
    name: "Technical",
    description: "Monospace accents with skills up front.",
    html: cvTechnicalHtml,
  },
  {
    id: "cv.ledger",
    kind: "cv",
    name: "Ledger",
    description: "A centered, traditional serif layout.",
    html: cvLedgerHtml,
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
    if (key === "skill_groups") return renderSkillGroups(data);
    return stringifyTemplateValue(data[key], key);
  });
}

/**
 * Renders `{{skill_groups}}`: one `skills-list` per category under its name, or a single plain
 * `skills-list` when nothing is categorized so uncategorized CVs look as they always have. Falls
 * back to the flat `skills` list for callers that do not pass groups.
 */
function renderSkillGroups(data: Record<string, unknown>): string {
  const groups = Array.isArray(data.skill_groups)
    ? (data.skill_groups as ProfileSkillGroup[])
    : [{ name: "", skills: Array.isArray(data.skills) ? (data.skills as string[]) : [] }];
  const list = (skills: string[]) =>
    `<ul class="skills-list">${skills.map((skill) => `<li>${escapeHtml(skill)}</li>`).join("")}</ul>`;

  if (!hasNamedSkillGroups(groups)) return list(groups.flatMap((group) => group.skills));

  return groups
    .filter((group) => group.skills.length > 0)
    .map(
      (group) =>
        `<div class="skill-group"><h3 class="skill-group-name">${escapeHtml(
          group.name.trim() || UNCATEGORIZED_SKILL_GROUP_LABEL,
        )}</h3>${list(group.skills)}</div>`,
    )
    .join("");
}

// Lets the array branch below tag each rendered `<li>` with a `data-field-ref` the preview iframe
// can scroll to and highlight when a tip is clicked (see apps/web/src/lib/paged-preview.ts) — the
// prefix is derived from which mustache field is being rendered, not from the item's own shape.
const arrayFieldRefPrefix: Record<string, string> = {
  experience_content: "experience",
  education_content: "education",
  project_content: "project",
};

function stringifyTemplateValue(value: unknown, key?: string): string {
  if (value === undefined || value === null) {
    return "";
  }

  if (Array.isArray(value)) {
    const prefix = key ? arrayFieldRefPrefix[key] : undefined;
    return value
      .map(
        (item, index) =>
          `<li${prefix ? ` data-field-ref="${prefix}-${index}"` : ""}>${stringifyStructuredValue(item)}</li>`,
      )
      .join("");
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
