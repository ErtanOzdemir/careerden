import { describe, expect, it } from "vitest";
import { diffRichDocuments, diffWords } from "./document-diff.js";

describe("diffWords", () => {
  it("marks inserted and removed words while keeping shared text", () => {
    expect(diffWords("Built TypeScript APIs", "Built production TypeScript services")).toEqual([
      { type: "same", text: "Built " },
      { type: "added", text: "production " },
      { type: "same", text: "TypeScript " },
      { type: "removed", text: "APIs" },
      { type: "added", text: "services" },
    ]);
  });

  it("returns a single unchanged segment for identical text", () => {
    expect(diffWords("Same text", "Same text")).toEqual([{ type: "same", text: "Same text" }]);
  });
});

describe("diffRichDocuments", () => {
  it("shows list markers so a new bullet is visible", () => {
    const item = (text: string) => ({
      blocks: [{ type: "paragraph" as const, children: [{ type: "text" as const, text }] }],
    });

    expect(
      diffRichDocuments(
        { version: 1, blocks: [{ type: "bulletList", items: [item("Built APIs")] }] },
        {
          version: 1,
          blocks: [{ type: "bulletList", items: [item("Built APIs"), item("Led migration")] }],
        },
      ),
    ).toEqual([
      { type: "same", text: "• Built APIs" },
      { type: "added", text: "\n• Led migration" },
    ]);
  });
});
