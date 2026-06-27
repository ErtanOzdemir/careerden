import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import type {
  DocumentTemplate,
  DocxTemplateRenderer,
  RichBlock,
  RichDocument,
  RichTextNode,
  SelectedEducationTemplateField,
  SelectedExperienceTemplateField,
  SelectedProjectTemplateField,
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

    const richDocuments = new Map<string, { document: RichDocument; variableName: string }>();
    const aliases = replaceRichDocumentsWithTokens(
      buildDocxAliasData(input.template, input.data),
      richDocuments,
    );

    doc.render(aliases);

    if (richDocuments.size > 0) {
      renderRichDocuments(doc.getZip(), richDocuments);
    }

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

  addLinkAliases(aliases, data.links, template.variableAliases.linkItems);
  addLinkAliases(aliases, data.certifications, template.variableAliases.certificationItems);
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
  addSelectedProjectAliases(
    aliases,
    data.selected_projects,
    template.variableAliases.selectedProjects,
  );
  addFieldMappings(aliases, data, template.fieldMappings);

  return aliases;
}

function addLinkAliases(
  aliases: Record<string, unknown>,
  value: unknown,
  configured: Array<{ variableName?: string }> | undefined,
) {
  if (!Array.isArray(value) || !configured) {
    return;
  }

  configured.forEach((item, index) => {
    if (item.variableName) {
      aliases[item.variableName] = toDocxValue(value[index]);
    }
  });
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

function addSelectedProjectAliases(
  aliases: Record<string, unknown>,
  value: unknown,
  configured:
    | {
        fields: Partial<Record<SelectedProjectTemplateField, string>>;
        items?: Array<{
          fields: Partial<Record<SelectedProjectTemplateField, string>>;
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
    const project =
      typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};

    for (const [field, variableName] of Object.entries(configuredItem.fields)) {
      if (variableName) {
        aliases[variableName] = toDocxValue(project[field]);
      }
    }
  });
}

function addFieldMappings(
  aliases: Record<string, unknown>,
  data: Record<string, unknown>,
  fieldMappings: Record<string, string> | undefined,
) {
  if (!fieldMappings) {
    return;
  }

  for (const [placeholder, field] of Object.entries(fieldMappings)) {
    if (aliases[placeholder] !== undefined) {
      continue;
    }

    aliases[placeholder] = toDocxValue(data[field]);
  }
}

function toDocxValue(value: unknown): unknown {
  if (value === undefined || value === null) {
    return "";
  }

  if (Array.isArray(value)) {
    if (value.every(isRichDocument)) {
      return combineRichDocuments(value);
    }

    if (value.every((item) => typeof item === "object" && item !== null && !Array.isArray(item))) {
      return value.map((item) => toDocxObject(item as Record<string, unknown>));
    }

    return value.map(stringifyDocxListItem).filter(Boolean).join("\n");
  }

  if (typeof value === "object") {
    if (isRichDocument(value)) {
      return value;
    }

    return toDocxObject(value as Record<string, unknown>);
  }

  return String(value);
}

function isRichDocument(value: unknown): value is RichDocument {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { version?: unknown }).version === 1 &&
    Array.isArray((value as { blocks?: unknown }).blocks)
  );
}

function combineRichDocuments(documents: RichDocument[]): RichDocument {
  return {
    version: 1,
    blocks: documents.flatMap((document) => document.blocks),
  };
}

function replaceRichDocumentsWithTokens(
  aliases: Record<string, unknown>,
  richDocuments: Map<string, { document: RichDocument; variableName: string }>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(aliases).map(([variableName, value]) => {
      if (!isRichDocument(value)) {
        return [variableName, value];
      }

      const token = `__LINK2CV_RICH_${richDocuments.size}__`;
      richDocuments.set(token, { document: value, variableName });
      return [variableName, token];
    }),
  );
}

function renderRichDocuments(
  zip: PizZip,
  richDocuments: Map<string, { document: RichDocument; variableName: string }>,
) {
  const documentFile = zip.file("word/document.xml");

  if (!documentFile) {
    throw new Error("DOCX template does not contain word/document.xml");
  }

  let documentXml = documentFile.asText();

  for (const [token, value] of richDocuments) {
    let replaced = false;
    documentXml = documentXml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, (paragraph) => {
      const text = extractParagraphText(paragraph);

      if (!text.includes(token)) {
        return paragraph;
      }

      if (text.trim() !== token) {
        throw new Error(
          `Rich DOCX placeholder "${value.variableName}" must occupy its own paragraph`,
        );
      }

      replaced = true;
      return value.document.blocks.map((block) => renderRichBlock(block)).join("");
    });

    if (!replaced) {
      throw new Error(`Rich DOCX placeholder "${value.variableName}" was not found`);
    }
  }

  zip.file("word/document.xml", documentXml);
  ensureNumberingPart(zip);
}

function extractParagraphText(paragraph: string): string {
  return [...paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map((match) => decodeXml(match[1]))
    .join("");
}

function renderRichBlock(block: RichBlock, numbering?: { id: number; level: number }): string {
  if (block.type === "paragraph" || block.type === "heading") {
    const properties = [
      block.type === "heading" ? `<w:pStyle w:val="Heading${block.level}"/>` : "",
      block.alignment ? `<w:jc w:val="${block.alignment}"/>` : "",
      numbering
        ? `<w:numPr><w:ilvl w:val="${numbering.level}"/><w:numId w:val="${numbering.id}"/></w:numPr>`
        : "",
    ].join("");
    return `<w:p>${properties ? `<w:pPr>${properties}</w:pPr>` : ""}${block.children
      .map(renderRichTextNode)
      .join("")}</w:p>`;
  }

  if ("items" in block) {
    const id = block.type === "orderedList" ? 2 : 1;
    return block.items
      .map((item) =>
        item.blocks
          .map((itemBlock, index) =>
            renderRichBlock(itemBlock, index === 0 ? { id, level: 0 } : undefined),
          )
          .join(""),
      )
      .join("");
  }

  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr>${block.rows
    .map(
      (row) =>
        `<w:tr>${row.cells
          .map(
            (cell) =>
              `<w:tc><w:tcPr/>${cell.blocks.map((cellBlock) => renderRichBlock(cellBlock)).join("")}</w:tc>`,
          )
          .join("")}</w:tr>`,
    )
    .join("")}</w:tbl>`;
}

function renderRichTextNode(node: RichTextNode): string {
  const runProperties = (node.marks ?? [])
    .map((mark) => {
      if (mark.type === "bold") return "<w:b/>";
      if (mark.type === "italic") return "<w:i/>";
      if (mark.type === "underline") return '<w:u w:val="single"/>';
      return "";
    })
    .join("");
  const run = `<w:r>${runProperties ? `<w:rPr>${runProperties}</w:rPr>` : ""}<w:t xml:space="preserve">${escapeXml(node.text)}</w:t></w:r>`;
  const link = node.marks?.find((mark) => mark.type === "link");

  return link?.type === "link"
    ? `<w:fldSimple w:instr="HYPERLINK &quot;${escapeXml(link.href)}&quot;">${run}</w:fldSimple>`
    : run;
}

function ensureNumberingPart(zip: PizZip) {
  if (!zip.file("word/numbering.xml")) {
    zip.file(
      "word/numbering.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="720"/></w:tabs><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>
  <w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="720"/></w:tabs><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`,
    );
  }

  const contentTypesFile = zip.file("[Content_Types].xml");
  if (contentTypesFile) {
    const contentTypes = contentTypesFile.asText();
    if (!contentTypes.includes("/word/numbering.xml")) {
      zip.file(
        "[Content_Types].xml",
        contentTypes.replace(
          "</Types>",
          '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>',
        ),
      );
    }
  }

  const relationshipsFile = zip.file("word/_rels/document.xml.rels");
  if (relationshipsFile) {
    const relationships = relationshipsFile.asText();
    if (!relationships.includes("relationships/numbering")) {
      zip.file(
        "word/_rels/document.xml.rels",
        relationships.replace(
          "</Relationships>",
          '<Relationship Id="rIdLink2cvNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>',
        ),
      );
    }
  }
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function decodeXml(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
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
