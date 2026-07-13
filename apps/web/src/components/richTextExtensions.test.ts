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
    expect(editor.commands.toggleOrderedList()).toBe(true);
    expect(editor.getJSON().content?.[0]?.type).toBe("orderedList");

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

  it("applies and updates a link on the selected text", () => {
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

    editor.commands.setTextSelection({ from: 1, to: 9 });
    expect(applyLink(editor, "https://example.com")).toBe(true);
    expect(editor.getJSON().content?.[0]?.content?.[0]?.marks?.[0]?.attrs?.href).toBe(
      "https://example.com",
    );

    editor.commands.setTextSelection(3);
    expect(applyLink(editor, "https://updated.example.com")).toBe(true);
    expect(editor.getJSON().content?.[0]?.content?.[0]?.marks?.[0]?.attrs?.href).toBe(
      "https://updated.example.com",
    );
  });

  it("rejects empty and unsafe link targets", () => {
    const editor = new Editor({
      element: null,
      extensions: createRichTextExtensions(),
      content: { type: "doc", content: [{ type: "paragraph" }] },
    });

    expect(applyLink(editor, "  ")).toBe(false);
    expect(applyLink(editor, "javascript:alert(1)")).toBe(false);
    expect(editor.getText()).toBe("");
  });
});
