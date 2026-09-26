import type { AiFieldTipRevisionBlockDto } from "@careerden/contracts";
import type { RichBlock, RichDocument, RichParagraph } from "@careerden/domain";

type RevisionBlockKind = AiFieldTipRevisionBlockDto["kind"];

/**
 * Describes a CV field's structure to the AI as paragraph runs and lists, so the revision can keep
 * bullets as bullets instead of collapsing everything into prose. Inline marks are not represented.
 */
export function richDocumentToRevisionBlocks(document: RichDocument): AiFieldTipRevisionBlockDto[] {
  const blocks: AiFieldTipRevisionBlockDto[] = [];

  for (const block of document.blocks) {
    const kind = revisionKindOf(block);
    const lines = revisionLinesOf(block);
    if (lines.length === 0) continue;

    const previous = blocks.at(-1);
    if (previous && previous.kind === "paragraphs" && kind === "paragraphs") {
      previous.lines.push(...lines);
    } else {
      blocks.push({ kind, lines });
    }
  }

  return blocks;
}

/** Rebuilds a RichDocument from the AI's revision blocks, dropping empty lines and stray markers. */
export function revisionBlocksToRichDocument(blocks: AiFieldTipRevisionBlockDto[]): RichDocument {
  const richBlocks: RichBlock[] = [];

  for (const block of blocks) {
    if (block.kind === "paragraphs") {
      richBlocks.push(...cleanLines(block.lines, false).map(paragraph));
      continue;
    }

    const items = cleanLines(block.lines, true);
    if (items.length === 0) continue;
    richBlocks.push({
      type: block.kind === "bullets" ? "bulletList" : "orderedList",
      items: items.map((item) => ({ blocks: [paragraph(item)] })),
    });
  }

  return { version: 1, blocks: richBlocks };
}

function revisionKindOf(block: RichBlock): RevisionBlockKind {
  if (block.type === "bulletList") return "bullets";
  if (block.type === "orderedList") return "numbered";
  return "paragraphs";
}

function revisionLinesOf(block: RichBlock): string[] {
  switch (block.type) {
    case "paragraph":
    case "heading":
      return nonEmpty([block.children.map((child) => child.text).join("")]);
    case "bulletList":
    case "orderedList":
      return nonEmpty(block.items.map((item) => item.blocks.flatMap(revisionLinesOf).join(" ")));
    case "table":
      return nonEmpty(
        block.rows.map((row) =>
          row.cells.map((cell) => cell.blocks.flatMap(revisionLinesOf).join(" ")).join(" | "),
        ),
      );
  }
}

const listMarker = /^\s*(?:[-*•·▪◦–—]|\d+[.)])\s+/;

function cleanLines(lines: string[], stripListMarkers: boolean): string[] {
  return nonEmpty(
    lines.map((line) =>
      (stripListMarkers ? line.replace(listMarker, "") : line).replace(/\s+/g, " "),
    ),
  );
}

function nonEmpty(lines: string[]): string[] {
  return lines.map((line) => line.trim()).filter(Boolean);
}

function paragraph(text: string): RichParagraph {
  return { type: "paragraph", children: [{ type: "text", text }] };
}
