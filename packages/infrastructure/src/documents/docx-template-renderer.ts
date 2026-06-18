import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import type {
  DocumentTemplate,
  DocxTemplateRenderer,
  SelectedEducationTemplateField,
  SelectedExperienceTemplateField,
} from "@link2cv/domain";

const placeholderPattern = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
const sectionPattern = /\{\{\s*#([a-zA-Z0-9_]+)\s*\}\}([\s\S]*?)\{\{\s*\/\1\s*\}\}/g;

export class DocxtemplaterTemplateRenderer implements DocxTemplateRenderer {
  async extractPlaceholders(template: Buffer): Promise<string[]> {
    const zip = new PizZip(template);
    const doc = new Docxtemplater(zip, {
      delimiters: { start: "{{", end: "}}" },
      paragraphLoop: true,
      linebreaks: true,
    });
    const text = doc.getFullText();
    const placeholders = new Set<string>();
    let textWithoutSections = text;

    for (const match of text.matchAll(sectionPattern)) {
      placeholders.add(match[1]);
      textWithoutSections = textWithoutSections.replace(match[0], "");
    }

    for (const match of textWithoutSections.matchAll(placeholderPattern)) {
      placeholders.add(match[1]);
    }

    return [...placeholders].sort((left, right) => left.localeCompare(right));
  }

  async render(input: {
    template: DocumentTemplate;
    templateBody: Buffer;
    data: Record<string, unknown>;
  }): Promise<Buffer> {
    const zip = new PizZip(input.templateBody);
    const doc = new Docxtemplater(zip, {
      delimiters: { start: "{{", end: "}}" },
      paragraphLoop: true,
      linebreaks: true,
      nullGetter(part) {
        if (!part.module) {
          return `{{${part.value}}}`;
        }

        return "";
      },
    });

    doc.render(buildDocxAliasData(input.template, input.data));

    return doc.getZip().generate({
      type: "nodebuffer",
      compression: "DEFLATE",
    }) as Buffer;
  }
}

export function buildDocxAliasData(
  template: DocumentTemplate,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const aliases: Record<string, unknown> = {};

  for (const [field, variableName] of Object.entries(template.variableAliases.fields)) {
    if (variableName) {
      aliases[variableName] = toDocxValue(data[field]);
    }
  }

  addSelectedExperienceAliases(
    aliases,
    data.selected_experiences,
    template.variableAliases.selectedExperiences,
  );
  addSelectedEducationAliases(
    aliases,
    data.selected_education,
    template.variableAliases.selectedEducation,
  );

  return aliases;
}

function addSelectedExperienceAliases(
  aliases: Record<string, unknown>,
  value: unknown,
  configured:
    | {
        fields: Partial<Record<SelectedExperienceTemplateField, string>>;
        items?: Array<{
          fields: Partial<Record<SelectedExperienceTemplateField, string>>;
        }>;
      }
    | undefined,
) {
  if (!Array.isArray(value) || !configured) {
    return;
  }

  const itemAliases =
    configured.items && configured.items.length > 0
      ? configured.items
      : [{ fields: configured.fields }];

  itemAliases.forEach((configuredItem, index) => {
    const item = value[index];
    const experience =
      typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};

    for (const [field, variableName] of Object.entries(configuredItem.fields)) {
      if (variableName) {
        aliases[variableName] = toDocxValue(experience[field]);
      }
    }
  });
}

function addSelectedEducationAliases(
  aliases: Record<string, unknown>,
  value: unknown,
  configured:
    | {
        fields: Partial<Record<SelectedEducationTemplateField, string>>;
        items?: Array<{
          fields: Partial<Record<SelectedEducationTemplateField, string>>;
        }>;
      }
    | undefined,
) {
  if (!Array.isArray(value) || !configured) {
    return;
  }

  const itemAliases =
    configured.items && configured.items.length > 0
      ? configured.items
      : [{ fields: configured.fields }];

  itemAliases.forEach((configuredItem, index) => {
    const item = value[index];
    const education =
      typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};

    for (const [field, variableName] of Object.entries(configuredItem.fields)) {
      if (variableName) {
        aliases[variableName] = toDocxValue(education[field]);
      }
    }
  });
}

function toDocxValue(value: unknown): unknown {
  if (value === undefined || value === null) {
    return "";
  }

  if (Array.isArray(value)) {
    if (value.every((item) => typeof item === "object" && item !== null && !Array.isArray(item))) {
      return value.map((item) => toDocxObject(item as Record<string, unknown>));
    }

    return value.map(stringifyDocxListItem).filter(Boolean).join("\n");
  }

  if (typeof value === "object") {
    return toDocxObject(value as Record<string, unknown>);
  }

  return String(value);
}

function stringifyDocxListItem(value: unknown): string {
  if (typeof value === "object" && value !== null) {
    return stringifyDocxObject(value as Record<string, unknown>);
  }

  return String(value);
}

function toDocxObject(value: Record<string, unknown>): Record<string, unknown> {
  return {
    ...Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        Array.isArray(item) ? item.map(stringifyDocxListItem).filter(Boolean).join("\n") : item,
      ]),
    ),
    text: stringifyDocxObject(value),
  };
}

function stringifyDocxObject(value: Record<string, unknown>): string {
  const preferred = [
    value.title,
    value.company,
    value.period,
    value.institution,
    value.degree,
    value.field,
    value.description,
  ]
    .filter(Boolean)
    .map(String)
    .join(" - ");

  const achievements = Array.isArray(value.achievements)
    ? value.achievements.map(String).join("; ")
    : undefined;

  return [preferred, achievements].filter(Boolean).join("\n");
}
