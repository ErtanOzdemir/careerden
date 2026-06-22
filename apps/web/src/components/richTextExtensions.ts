import { Link } from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import { TextAlign } from "@tiptap/extension-text-align";
import StarterKit from "@tiptap/starter-kit";
import type { Editor } from "@tiptap/react";

export function createRichTextExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      blockquote: false,
      code: false,
      codeBlock: false,
      hardBreak: false,
      horizontalRule: false,
      link: false,
      strike: false,
    }),
    Link.configure({ openOnClick: false, autolink: true }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
  ];
}

export function applyLink(editor: Editor, href: string): boolean {
  if (editor.isActive("link")) {
    return editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }

  if (editor.state.selection.empty) {
    return editor.commands.insertContent({
      type: "text",
      text: href,
      marks: [{ type: "link", attrs: { href } }],
    });
  }

  return editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
}
