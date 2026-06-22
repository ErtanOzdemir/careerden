import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { RichDocument } from "../api/types";
import { fromTiptapJson, toTiptapJson } from "./richDocumentAdapter";
import { applyLink, createRichTextExtensions } from "./richTextExtensions";

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
        class: "rich-editor-content text-body-md text-on-surface-variant outline-none",
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
        class:
          "rich-editor-content min-h-32 rounded-b-lg bg-surface px-3 py-3 text-body-md outline-none",
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
    <div className="rounded-lg border border-outline-variant bg-surface">
      <div className="flex flex-wrap gap-1 border-b border-outline-variant bg-surface-container-low px-2 py-2">
        <ToolbarButton
          active={editor.isActive("bold")}
          icon="format_bold"
          label="Bold"
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          active={editor.isActive("italic")}
          icon="format_italic"
          label="Italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          active={editor.isActive("underline")}
          icon="format_underlined"
          label="Underline"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />
        <ToolbarButton
          active={editor.isActive("bulletList")}
          icon="format_list_bulleted"
          label="Bullet list"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          active={editor.isActive("orderedList")}
          icon="format_list_numbered"
          label="Numbered list"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarButton
          active={editor.isActive("heading", { level: 2 })}
          icon="title"
          label="Heading"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <ToolbarButton
          active={editor.isActive("link")}
          icon="link"
          label="Link"
          onClick={setLink}
        />
        <ToolbarButton
          active={editor.isActive({ textAlign: "left" })}
          icon="format_align_left"
          label="Align left"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        />
        <ToolbarButton
          active={editor.isActive({ textAlign: "center" })}
          icon="format_align_center"
          label="Align center"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        />
        <ToolbarButton
          active={editor.isActive({ textAlign: "right" })}
          icon="format_align_right"
          label="Align right"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        />
        <ToolbarButton
          active={editor.isActive({ textAlign: "justify" })}
          icon="format_align_justify"
          label="Justify"
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        />
        <ToolbarButton
          active={editor.isActive("table")}
          icon="table"
          label="Insert table"
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run()
          }
        />
        {editor.isActive("table") && (
          <ToolbarButton
            active={false}
            icon="delete"
            label="Delete table"
            onClick={() => editor.chain().focus().deleteTable().run()}
          />
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton(props: {
  active: boolean;
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={props.label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded ${
        props.active
          ? "bg-primary text-on-primary"
          : "text-secondary hover:bg-surface-container-high"
      }`}
      onClick={props.onClick}
      title={props.label}
      type="button"
    >
      <span className="material-symbols-outlined text-[18px]">{props.icon}</span>
    </button>
  );
}
