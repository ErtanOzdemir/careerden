import { describe, expect, it } from "vitest";
import type { RichDocument } from "@careerden/domain";
import { renderRichDocumentToHtml } from "./rich-document-html.js";

describe("renderRichDocumentToHtml", () => {
  it("renders portable formatting as safe HTML", () => {
    const document: RichDocument = {
      version: 1,
      blocks: [
        {
          type: "heading",
          level: 2,
          alignment: "center",
          children: [
            { type: "text", text: "Strong", marks: [{ type: "bold" }] },
            { type: "text", text: " & safe", marks: [{ type: "italic" }] },
          ],
        },
        {
          type: "bulletList",
          items: [
            {
              blocks: [
                {
                  type: "paragraph",
                  children: [
                    {
                      type: "text",
                      text: "Portfolio",
                      marks: [{ type: "link", href: "https://example.com?a=1&b=2" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(renderRichDocumentToHtml(document)).toBe(
      '<h2 style="text-align:center"><strong>Strong</strong><em> &amp; safe</em></h2>' +
        '<ul><li><p><a href="https://example.com?a=1&amp;b=2">Portfolio</a></p></li></ul>',
    );
  });
});
