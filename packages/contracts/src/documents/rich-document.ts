/**
 * The rich-text document shape and the pure helpers that operate on it.
 *
 * These live in `contracts` rather than `domain` so the browser app can share them: `apps/web` must
 * not depend on `domain`, whose barrel exposes repository and queue interfaces that have no business
 * being importable from a React component. `domain` re-exports everything here, so its consumers are
 * unaffected.
 *
 * The interfaces are hand-written rather than inferred from `richDocumentSchema`: that schema needs
 * `z.lazy` for its recursion and is annotated `z.ZodTypeAny`, so `z.infer` degrades `blocks` to
 * `any[]`.
 */

export type RichTextMark =
  { type: "bold" } | { type: "italic" } | { type: "underline" } | { type: "link"; href: string };

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

export function emptyRichDocument(): RichDocument {
  return { version: 1, blocks: [] };
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

export function richDocumentToPlainText(document: RichDocument): string {
  return document.blocks.map(blockToPlainText).filter(Boolean).join("\n");
}

/**
 * Flattens several documents into one paragraph of deduplicated sentences. Used wherever separate
 * fragments (a description plus its achievements) have to render as a single prose block.
 */
export function mergeRichDocumentsAsProse(
  ...documents: Array<RichDocument | undefined>
): RichDocument | undefined {
  const nonEmptyDocuments = documents.filter((document): document is RichDocument =>
    Boolean(document && richDocumentToPlainText(document)),
  );
  if (nonEmptyDocuments.length === 0) return undefined;
  if (
    nonEmptyDocuments.length === 1 &&
    nonEmptyDocuments[0]?.blocks.length === 1 &&
    nonEmptyDocuments[0].blocks[0]?.type === "paragraph"
  ) {
    return nonEmptyDocuments[0];
  }

  const seen = new Set<string>();
  const sentences = nonEmptyDocuments
    .flatMap((document) => richDocumentToPlainText(document).split(/\n+/))
    .flatMap((text) => text.trim().split(/(?<=[.!?])\s+/))
    .map((text) => text.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .filter((text) => {
      const key = withoutTrailingPunctuation(text.toLocaleLowerCase());
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((text) => (/[.!?]$/.test(text) ? text : `${text}.`));

  return sentences.length > 0 ? richDocumentFromText(sentences.join(" ")) : undefined;
}

// A loop rather than /[.!?]+$/, which rescans a long run of punctuation from every position when
// the text does not end in one.
function withoutTrailingPunctuation(text: string): string {
  let end = text.length;
  while (end > 0 && ".!?".includes(text.charAt(end - 1))) end -= 1;
  return text.slice(0, end);
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
