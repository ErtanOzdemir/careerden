import type { RichBlock, RichDocument } from "../api/types.js";

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
      const key = text.toLocaleLowerCase().replace(/[.!?]+$/, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((text) => (/[.!?]$/.test(text) ? text : `${text}.`));

  return sentences.length > 0 ? richDocumentFromText(sentences.join(" ")) : undefined;
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
