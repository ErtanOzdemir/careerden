import { describe, expect, it } from "vitest";
import type { RichDocument } from "../api/types";
import { fromTiptapJson, toTiptapJson } from "./richDocumentAdapter";

describe("richDocumentAdapter", () => {
  it("round-trips portable rich document content", () => {
    const document: RichDocument = {
      version: 1,
      blocks: [
        {
          type: "heading",
          level: 2,
          alignment: "center",
          children: [
            {
              type: "text",
              text: "Engineer",
              marks: [{ type: "bold" }, { type: "link", href: "https://example.com" }],
            },
          ],
        },
        {
          type: "bulletList",
          items: [
            {
              blocks: [
                {
                  type: "paragraph",
                  children: [{ type: "text", text: "Built reliable systems" }],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(fromTiptapJson(toTiptapJson(document))).toEqual(document);
  });
});
