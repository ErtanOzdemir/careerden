import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { RichDocument } from "../api/types";
import { fromTiptapJson, toTiptapJson } from "./richDocumentAdapter";
import { applyLink, createRichTextExtensions } from "./richTextExtensions";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Heading2,
  Italic,
  Link,
  List,
  ListOrdered,
  Table,
  Trash2,
  Underline,
} from "lucide-react";

interface RichTextEditorProps {
  ariaLabel: string;
  value: RichDocument;
  onChange: (value: RichDocument) => void;
}

export function RichTextViewer({ ariaLabel, value }: { ariaLabel: string; value: RichDocument }) {
  const editor = useEditor({
    extensions: createRichTextExtensions(),
    content: toTiptapJson(value),
    editable: false,
    editorProps: {
      attributes: {
        "aria-label": ariaLabel,
        class: "rich-editor-content text-sm text-muted-foreground outline-none",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;

    const currentValue = fromTiptapJson(editor.getJSON());
    if (JSON.stringify(currentValue) !== JSON.stringify(value)) {
      editor.commands.setContent(toTiptapJson(value), { emitUpdate: false });
    }
  }, [editor, value]);

  return editor ? <EditorContent editor={editor} /> : null;
}

export default function RichTextEditor({ ariaLabel, onChange, value }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: createRichTextExtensions(),
    content: toTiptapJson(value),
    editorProps: {
      attributes: {
        "aria-label": ariaLabel,
        class: "rich-editor-content min-h-32 rounded-b-lg bg-card px-3 py-3 text-sm outline-none",
      },
    },
    onUpdate({ editor: updatedEditor }) {
      onChange(fromTiptapJson(updatedEditor.getJSON()));
    },
  });

  useEffect(() => {
    if (!editor) return;

    const currentValue = fromTiptapJson(editor.getJSON());
    if (JSON.stringify(currentValue) !== JSON.stringify(value)) {
      editor.commands.setContent(toTiptapJson(value), { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) {
    return null;
  }

  function setLink() {
    const previousUrl = editor?.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previousUrl ?? "https://");

    if (url === null || !editor) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    applyLink(editor, url.trim());
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap gap-1 border-b border-border bg-muted px-2 py-2">
        <ToolbarButton
          active={editor.isActive("bold")}
          label="Bold"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="size-[18px]" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          label="Italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-[18px]" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("underline")}
          label="Underline"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <Underline className="size-[18px]" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("bulletList")}
          label="Bullet list"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="size-[18px]" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("orderedList")}
          label="Numbered list"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="size-[18px]" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("heading", { level: 2 })}
          label="Heading"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="size-[18px]" />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive("link")} label="Link" onClick={setLink}>
          <Link className="size-[18px]" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive({ textAlign: "left" })}
          label="Align left"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft className="size-[18px]" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive({ textAlign: "center" })}
          label="Align center"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter className="size-[18px]" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive({ textAlign: "right" })}
          label="Align right"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight className="size-[18px]" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive({ textAlign: "justify" })}
          label="Justify"
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        >
          <AlignJustify className="size-[18px]" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("table")}
          label="Insert table"
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run()
          }
        >
          <Table className="size-[18px]" />
        </ToolbarButton>
        {editor.isActive("table") && (
          <ToolbarButton
            active={false}
            label="Delete table"
            onClick={() => editor.chain().focus().deleteTable().run()}
          >
            <Trash2 className="size-[18px]" />
          </ToolbarButton>
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton(props: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={props.label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded ${
        props.active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
      }`}
      onClick={props.onClick}
      title={props.label}
      type="button"
    >
      {props.children}
    </button>
  );
}
