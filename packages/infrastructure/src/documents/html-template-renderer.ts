import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { TemplateRenderer } from "@link2cv/domain";

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
    return value.map((item) => `<li>${escapeHtml(stringifyPlainValue(item))}</li>`).join("");
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
