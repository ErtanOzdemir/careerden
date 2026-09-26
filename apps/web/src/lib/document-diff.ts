import type { RichBlock, RichDocument } from "@careerden/contracts";

export interface DiffSegment {
  type: "same" | "added" | "removed";
  text: string;
}

/** Beyond this many token comparisons, fall back to a whole-field replace instead of a word diff. */
const MAX_DIFF_CELLS = 250_000;

/**
 * Word-level diff between two rich documents, rendered as display text where list items keep a
 * visible marker so structural changes (a bullet added, prose turned into bullets) stay readable.
 */
export function diffRichDocuments(before: RichDocument, after: RichDocument): DiffSegment[] {
  return diffWords(richDocumentToDisplayText(before), richDocumentToDisplayText(after));
}

export function richDocumentToDisplayText(document: RichDocument): string {
  return document.blocks.flatMap((block) => blockToDisplayLines(block)).join("\n");
}

export function diffWords(before: string, after: string): DiffSegment[] {
  const left = tokenize(before);
  const right = tokenize(after);

  if (left.length * right.length > MAX_DIFF_CELLS) {
    return mergeSegments([
      { type: "removed", text: before },
      { type: "added", text: after },
    ]);
  }

  // lengths[i][j] = LCS length of left[i..] and right[j..]
  const lengths = Array.from({ length: left.length + 1 }, () =>
    new Array<number>(right.length + 1).fill(0),
  );
  for (let i = left.length - 1; i >= 0; i--) {
    for (let j = right.length - 1; j >= 0; j--) {
      lengths[i]![j] =
        left[i] === right[j]
          ? lengths[i + 1]![j + 1]! + 1
          : Math.max(lengths[i + 1]![j]!, lengths[i]![j + 1]!);
    }
  }

  const segments: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      segments.push({ type: "same", text: left[i]! });
      i++;
      j++;
    } else if (lengths[i + 1]![j]! >= lengths[i]![j + 1]!) {
      segments.push({ type: "removed", text: left[i]! });
      i++;
    } else {
      segments.push({ type: "added", text: right[j]! });
      j++;
    }
  }
  for (; i < left.length; i++) segments.push({ type: "removed", text: left[i]! });
  for (; j < right.length; j++) segments.push({ type: "added", text: right[j]! });

  return mergeSegments(segments);
}

function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter(Boolean);
}

function mergeSegments(segments: DiffSegment[]): DiffSegment[] {
  const merged: DiffSegment[] = [];
  for (const segment of segments) {
    if (!segment.text) continue;
    const previous = merged.at(-1);
    if (previous?.type === segment.type) {
      previous.text += segment.text;
    } else {
      merged.push({ ...segment });
    }
  }
  return merged;
}

function blockToDisplayLines(block: RichBlock): string[] {
  switch (block.type) {
    case "paragraph":
    case "heading":
      return [block.children.map((child) => child.text).join("")];
    case "bulletList":
    case "orderedList":
      return block.items.map((item, index) => {
        const marker = block.type === "bulletList" ? "•" : `${index + 1}.`;
        return `${marker} ${item.blocks.flatMap(blockToDisplayLines).join(" ")}`;
      });
    case "table":
      return block.rows.map((row) =>
        row.cells.map((cell) => cell.blocks.flatMap(blockToDisplayLines).join(" ")).join(" | "),
      );
  }
}
