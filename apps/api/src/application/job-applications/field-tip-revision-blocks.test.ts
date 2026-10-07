import type { RichDocument } from "@careerden/domain";
import { describe, expect, it } from "vitest";
import {
  revisionBlocksToRichDocument,
  richDocumentToRevisionBlocks,
} from "./field-tip-revision-blocks.js";

describe("richDocumentToRevisionBlocks", () => {
  it("groups consecutive paragraphs and keeps lists as separate blocks", () => {
    const document: RichDocument = {
      version: 1,
      blocks: [
        paragraph("Backend engineer."),
        paragraph("Owns billing services."),
        {
          type: "bulletList",
          items: [{ blocks: [paragraph("Built TypeScript APIs")] }, { blocks: [paragraph("  ")] }],
        },
        { type: "orderedList", items: [{ blocks: [paragraph("Migrated to PostgreSQL")] }] },
      ],
    };

    expect(richDocumentToRevisionBlocks(document)).toEqual([
      { kind: "paragraphs", lines: ["Backend engineer.", "Owns billing services."] },
      { kind: "bullets", lines: ["Built TypeScript APIs"] },
      { kind: "numbered", lines: ["Migrated to PostgreSQL"] },
    ]);
  });
});

describe("revisionBlocksToRichDocument", () => {
  it("rebuilds bullet lists and strips list markers the model left in", () => {
    expect(
      revisionBlocksToRichDocument([
        { kind: "paragraphs", lines: ["Backend engineer.", ""] },
        { kind: "bullets", lines: ["- Built TypeScript APIs", "•  Led the migration", " "] },
        { kind: "numbered", lines: ["1. Shipped v2"] },
        { kind: "bullets", lines: [] },
      ]),
    ).toEqual({
      version: 1,
      blocks: [
        paragraph("Backend engineer."),
        {
          type: "bulletList",
          items: [
            { blocks: [paragraph("Built TypeScript APIs")] },
            { blocks: [paragraph("Led the migration")] },
          ],
        },
        { type: "orderedList", items: [{ blocks: [paragraph("Shipped v2")] }] },
      ],
    });
  });

  it("does not strip leading hyphenated words from paragraphs", () => {
    expect(revisionBlocksToRichDocument([{ kind: "paragraphs", lines: ["- 10 years"] }])).toEqual({
      version: 1,
      blocks: [paragraph("- 10 years")],
    });
  });
});

function paragraph(text: string) {
  return { type: "paragraph" as const, children: [{ type: "text" as const, text }] };
}
