import type { JSONContent } from "@tiptap/react";
import type { RichBlock, RichDocument, RichTextMark, RichTextNode } from "../api/types";

export function toTiptapJson(document: RichDocument): JSONContent {
  return {
    type: "doc",
    content: document.blocks.map(blockToTiptap),
  };
}

export function fromTiptapJson(content: JSONContent): RichDocument {
  return {
    version: 1,
    blocks: (content.content ?? []).map(blockFromTiptap).filter(isRichBlock),
  };
}

function blockToTiptap(block: RichBlock): JSONContent {
  if (block.type === "paragraph" || block.type === "heading") {
    return {
      type: block.type,
      ...(block.type === "heading" ? { attrs: { level: block.level } } : {}),
      ...(block.alignment
        ? {
            attrs: {
              ...(block.type === "heading" ? { level: block.level } : {}),
              textAlign: block.alignment,
            },
          }
        : {}),
      content: block.children.map(textToTiptap),
    };
  }

  if ("items" in block) {
    return {
      type: block.type,
      content: block.items.map((item) => ({
        type: "listItem",
        content: item.blocks.map(blockToTiptap),
      })),
    };
  }

  return {
    type: "table",
    content: block.rows.map((row) => ({
      type: "tableRow",
      content: row.cells.map((cell) => ({
        type: "tableCell",
        content: cell.blocks.map(blockToTiptap),
      })),
    })),
  };
}

function textToTiptap(node: RichTextNode): JSONContent {
  return {
    type: "text",
    text: node.text,
    ...(node.marks
      ? {
          marks: node.marks.map((mark) =>
            mark.type === "link"
              ? { type: "link", attrs: { href: mark.href } }
              : { type: mark.type },
          ),
        }
      : {}),
  };
}

function blockFromTiptap(node: JSONContent): RichBlock | null {
  if (node.type === "paragraph" || node.type === "heading") {
    const alignment = node.attrs?.textAlign;
    return {
      type: node.type,
      ...(node.type === "heading" ? { level: normalizeHeadingLevel(node.attrs?.level) } : {}),
      ...(isAlignment(alignment) ? { alignment } : {}),
      children: (node.content ?? []).map(textFromTiptap).filter(isRichTextNode),
    } as RichBlock;
  }

  if (node.type === "bulletList" || node.type === "orderedList") {
    return {
      type: node.type,
      items: (node.content ?? []).map((item) => ({
        blocks: (item.content ?? []).map(blockFromTiptap).filter(isRichBlock),
      })),
    };
  }

  if (node.type === "table") {
    return {
      type: "table",
      rows: (node.content ?? []).map((row) => ({
        cells: (row.content ?? []).map((cell) => ({
          blocks: (cell.content ?? []).map(blockFromTiptap).filter(isRichBlock),
        })),
      })),
    };
  }

  return null;
}

function textFromTiptap(node: JSONContent): RichTextNode | null {
  if (node.type !== "text" || typeof node.text !== "string") {
    return null;
  }

  const marks = (node.marks ?? []).map(markFromTiptap).filter(isRichTextMark);
  return {
    type: "text",
    text: node.text,
    ...(marks.length > 0 ? { marks } : {}),
  };
}

function markFromTiptap(mark: JSONContent): RichTextMark | null {
  if (mark.type === "bold" || mark.type === "italic" || mark.type === "underline") {
    return { type: mark.type };
  }

  if (mark.type === "link" && typeof mark.attrs?.href === "string") {
    return { type: "link", href: mark.attrs.href };
  }

  return null;
}

function normalizeHeadingLevel(value: unknown): 1 | 2 | 3 {
  return value === 1 || value === 2 || value === 3 ? value : 2;
}

function isAlignment(value: unknown): value is "left" | "center" | "right" | "justify" {
  return value === "left" || value === "center" || value === "right" || value === "justify";
}

function isRichBlock(value: RichBlock | null): value is RichBlock {
  return value !== null;
}

function isRichTextNode(value: RichTextNode | null): value is RichTextNode {
  return value !== null;
}

function isRichTextMark(value: RichTextMark | null): value is RichTextMark {
  return value !== null;
}
