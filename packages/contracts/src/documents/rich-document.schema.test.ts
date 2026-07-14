import { describe, expect, it } from "vitest";
import { documentContentSchema, richDocumentSchema } from "./rich-document.schema.js";

describe("richDocumentSchema", () => {
  it("accepts the portable rich-text feature set", () => {
    const result = richDocumentSchema.safeParse({
      version: 1,
      blocks: [
        {
          type: "heading",
          level: 2,
          alignment: "center",
          children: [
            { type: "text", text: "Senior ", marks: [{ type: "italic" }] },
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
                  children: [{ type: "text", text: "Reduced load time by 40%" }],
                },
              ],
            },
          ],
        },
        {
          type: "table",
          rows: [
            {
              cells: [
                {
                  blocks: [
                    {
                      type: "paragraph",
                      children: [{ type: "text", text: "TypeScript" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects unsafe links and unknown nodes", () => {
    expect(
      richDocumentSchema.safeParse({
        version: 1,
        blocks: [
          {
            type: "paragraph",
            children: [
              {
                type: "text",
                text: "Click",
                marks: [{ type: "link", href: "javascript:alert(1)" }],
              },
            ],
          },
        ],
      }).success,
    ).toBe(false);

    expect(
      richDocumentSchema.safeParse({
        version: 1,
        blocks: [{ type: "image", src: "https://example.com/image.png" }],
      }).success,
    ).toBe(false);
  });

  it("rejects excessively large documents", () => {
    expect(
      richDocumentSchema.safeParse({
        version: 1,
        blocks: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "x".repeat(20_001) }],
          },
        ],
      }).success,
    ).toBe(false);
  });
});

describe("documentContentSchema", () => {
  it("validates editable CV content", () => {
    const paragraph = {
      version: 1 as const,
      blocks: [
        {
          type: "paragraph" as const,
          children: [{ type: "text" as const, text: "Content" }],
        },
      ],
    };

    expect(
      documentContentSchema.parse({
        coverLetterContent: paragraph,
        customizedSummary: paragraph,
        formatVersion: 2,
        experienceEnhancements: [
          {
            experienceIndex: 0,
            description: paragraph,
            achievements: [paragraph],
          },
        ],
      }),
    ).toEqual({
      coverLetterContent: paragraph,
      customizedSummary: paragraph,
      formatVersion: 2,
      experienceEnhancements: [
        {
          experienceIndex: 0,
          description: paragraph,
          achievements: [paragraph],
        },
      ],
      skillSuggestions: [],
      educationEnhancements: [],
      projectEnhancements: [],
      certificationSuggestions: [],
      selections: {
        experience: {},
        education: {},
        projects: {},
      },
    });
  });
});
