import type { RichBlock, RichDocument, RichTextAlignment, RichTextNode } from "@link2cv/domain";

export function isRichDocument(value: unknown): value is RichDocument {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { version?: unknown }).version === 1 &&
    Array.isArray((value as { blocks?: unknown }).blocks)
  );
}

export function renderRichDocumentToHtml(document: RichDocument): string {
  return document.blocks.map(renderBlock).join("");
}

function renderBlock(block: RichBlock): string {
  if (block.type === "paragraph") {
    return `<p${alignmentAttribute(block.alignment)}>${renderInline(block.children)}</p>`;
  }

  if (block.type === "heading") {
    return `<h${block.level}${alignmentAttribute(block.alignment)}>${renderInline(block.children)}</h${block.level}>`;
  }

  if ("items" in block) {
    const tag = block.type === "orderedList" ? "ol" : "ul";
    const items = block.items
      .map((item) => `<li>${item.blocks.map(renderBlock).join("")}</li>`)
      .join("");
    return `<${tag}>${items}</${tag}>`;
  }

  const rows = block.rows
    .map(
      (row) =>
        `<tr>${row.cells
          .map((cell) => `<td>${cell.blocks.map(renderBlock).join("")}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  return `<table><tbody>${rows}</tbody></table>`;
}

function renderInline(children: RichTextNode[]): string {
  return children.map(renderText).join("");
}

function renderText(node: RichTextNode): string {
  let value = escapeHtml(node.text);

  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") value = `<strong>${value}</strong>`;
    if (mark.type === "italic") value = `<em>${value}</em>`;
    if (mark.type === "underline") value = `<u>${value}</u>`;
    if (mark.type === "link") value = `<a href="${escapeHtml(mark.href)}">${value}</a>`;
  }

  return value;
}

function alignmentAttribute(alignment: RichTextAlignment | undefined) {
  return alignment ? ` style="text-align:${alignment}"` : "";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
