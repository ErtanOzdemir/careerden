import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/react";
import { applyLink, createRichTextExtensions } from "./richTextExtensions";

describe("createRichTextExtensions", () => {
  it("registers every extension name once and supports lists and links", () => {
    const editor = new Editor({
      element: null,
      extensions: createRichTextExtensions(),
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Portable content" }],
          },
        ],
      },
    });
    const names = editor.extensionManager.extensions.map((extension) => extension.name);

    expect(new Set(names).size).toBe(names.length);

    editor.commands.selectAll();
    expect(editor.commands.toggleBulletList()).toBe(true);
    expect(editor.getJSON().content?.[0]?.type).toBe("bulletList");

    editor.commands.selectAll();
    expect(editor.commands.setLink({ href: "https://example.com" })).toBe(true);
    expect(
      editor.getJSON().content?.[0]?.content?.[0]?.content?.[0]?.content?.[0]?.marks?.[0]?.type,
    ).toBe("link");
  });

  it("inserts a visible linked URL when no text is selected", () => {
    const editor = new Editor({
      element: null,
      extensions: createRichTextExtensions(),
      content: { type: "doc", content: [{ type: "paragraph" }] },
    });

    expect(applyLink(editor, "https://example.com")).toBe(true);
    expect(editor.getText()).toBe("https://example.com");
    expect(editor.getJSON().content?.[0]?.content?.[0]?.marks?.[0]?.type).toBe("link");
  });
});
