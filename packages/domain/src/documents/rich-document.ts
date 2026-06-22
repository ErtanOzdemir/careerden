export type RichTextMark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "underline" }
  | { type: "link"; href: string };

export interface RichTextNode {
  type: "text";
  text: string;
  marks?: RichTextMark[];
}

export type RichTextAlignment = "left" | "center" | "right" | "justify";

export interface RichParagraph {
  type: "paragraph";
  alignment?: RichTextAlignment;
  children: RichTextNode[];
}

export interface RichHeading {
  type: "heading";
  level: 1 | 2 | 3;
  alignment?: RichTextAlignment;
  children: RichTextNode[];
}

export interface RichListItem {
  blocks: RichBlock[];
}

export interface RichList {
  type: "bulletList" | "orderedList";
  items: RichListItem[];
}

export interface RichTableCell {
  blocks: RichBlock[];
}

export interface RichTableRow {
  cells: RichTableCell[];
}

export interface RichTable {
  type: "table";
  rows: RichTableRow[];
}

export type RichBlock = RichParagraph | RichHeading | RichList | RichTable;

export interface RichDocument {
  version: 1;
  blocks: RichBlock[];
}

export interface DocumentContentExperienceEnhancement {
  experienceIndex: number;
  description?: RichDocument;
  achievements: RichDocument[];
}

export interface DocumentContent {
  customizedSummary: RichDocument;
  experienceEnhancements: DocumentContentExperienceEnhancement[];
}

export function richDocumentFromText(text: string): RichDocument {
  return {
    version: 1,
    blocks: text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({
        type: "paragraph" as const,
        children: [{ type: "text" as const, text: line }],
      })),
  };
}

export function documentContentFromMatchAnalysis(input: {
  customizedSummary: string;
  experienceEnhancements?: Array<{
    experienceIndex: number;
    enhancedDescription?: string;
    enhancedAchievements?: string[];
  }>;
}): DocumentContent {
  return {
    customizedSummary: richDocumentFromText(input.customizedSummary),
    experienceEnhancements: (input.experienceEnhancements ?? []).map((enhancement) => ({
      experienceIndex: enhancement.experienceIndex,
      ...(enhancement.enhancedDescription
        ? { description: richDocumentFromText(enhancement.enhancedDescription) }
        : {}),
      achievements: (enhancement.enhancedAchievements ?? []).map(richDocumentFromText),
    })),
  };
}

export function richDocumentToPlainText(document: RichDocument): string {
  return document.blocks.map(blockToPlainText).filter(Boolean).join("\n");
}

function blockToPlainText(block: RichBlock): string {
  if (block.type === "paragraph" || block.type === "heading") {
    return block.children.map((child) => child.text).join("");
  }

  if ("items" in block) {
    return block.items
      .map((item) => item.blocks.map(blockToPlainText).filter(Boolean).join("\n"))
      .filter(Boolean)
      .join("\n");
  }

  return block.rows
    .map((row) =>
      row.cells
        .map((cell) => cell.blocks.map(blockToPlainText).filter(Boolean).join("\n"))
        .join("\t"),
    )
    .join("\n");
}
