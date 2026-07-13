import { Popover } from "@base-ui/react/popover";
import { useEffect, useId, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import type { RichDocument } from "../api/types";
import { Button } from "./ui/button.js";
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

const defaultToolbarState = {
  alignCenter: false,
  alignLeft: false,
  alignRight: false,
  bold: false,
  bulletList: false,
  heading: false,
  italic: false,
  justify: false,
  link: false,
  orderedList: false,
  table: false,
  underline: false,
};

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
  const toolbarState = useRichTextToolbarState(editor);

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

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap gap-1 border-b border-border bg-muted px-2 py-2">
        <ToolbarButton
          active={toolbarState.bold}
          label="Bold"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="size-[18px]" />
        </ToolbarButton>
        <ToolbarButton
          active={toolbarState.italic}
          label="Italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-[18px]" />
        </ToolbarButton>
        <ToolbarButton
          active={toolbarState.underline}
          label="Underline"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <Underline className="size-[18px]" />
        </ToolbarButton>
        <ToolbarButton
          active={toolbarState.bulletList}
          label="Bullet list"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="size-[18px]" />
        </ToolbarButton>
        <ToolbarButton
          active={toolbarState.orderedList}
          label="Numbered list"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="size-[18px]" />
        </ToolbarButton>
        <ToolbarButton
          active={toolbarState.heading}
          label="Heading"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="size-[18px]" />
        </ToolbarButton>
        <LinkPopover active={toolbarState.link} editor={editor} />
        <ToolbarButton
          active={toolbarState.alignLeft}
          label="Align left"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft className="size-[18px]" />
        </ToolbarButton>
        <ToolbarButton
          active={toolbarState.alignCenter}
          label="Align center"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter className="size-[18px]" />
        </ToolbarButton>
        <ToolbarButton
          active={toolbarState.alignRight}
          label="Align right"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight className="size-[18px]" />
        </ToolbarButton>
        <ToolbarButton
          active={toolbarState.justify}
          label="Justify"
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        >
          <AlignJustify className="size-[18px]" />
        </ToolbarButton>
        <ToolbarButton
          active={toolbarState.table}
          label="Insert table"
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run()
          }
        >
          <Table className="size-[18px]" />
        </ToolbarButton>
        {toolbarState.table && (
          <ToolbarButton
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

export function useRichTextToolbarState(editor: Editor | null) {
  return (
    useEditorState({
      editor,
      selector: ({ editor: currentEditor }) => ({
        bold: currentEditor?.isActive("bold") ?? false,
        italic: currentEditor?.isActive("italic") ?? false,
        underline: currentEditor?.isActive("underline") ?? false,
        bulletList: currentEditor?.isActive("bulletList") ?? false,
        orderedList: currentEditor?.isActive("orderedList") ?? false,
        heading: currentEditor?.isActive("heading", { level: 2 }) ?? false,
        link: currentEditor?.isActive("link") ?? false,
        alignLeft: currentEditor?.isActive({ textAlign: "left" }) ?? false,
        alignCenter: currentEditor?.isActive({ textAlign: "center" }) ?? false,
        alignRight: currentEditor?.isActive({ textAlign: "right" }) ?? false,
        justify: currentEditor?.isActive({ textAlign: "justify" }) ?? false,
        table: currentEditor?.isActive("table") ?? false,
      }),
    }) ?? defaultToolbarState
  );
}

function LinkPopover({ active, editor }: { active: boolean; editor: Editor }) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef<{ from: number; to: number } | null>(null);
  const returnFocusToEditorRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [href, setHref] = useState("");
  const [open, setOpen] = useState(false);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      const { from, to } = editor.state.selection;
      const currentHref = editor.getAttributes("link").href;

      selectionRef.current = { from, to };
      returnFocusToEditorRef.current = false;
      setHref(typeof currentHref === "string" ? currentHref : "");
      setError(null);
    }

    setOpen(nextOpen);
  }

  function restoreSelection() {
    if (selectionRef.current) {
      editor.commands.setTextSelection(selectionRef.current);
    }
  }

  function closeAndReturnToEditor() {
    returnFocusToEditorRef.current = true;
    setOpen(false);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedHref = href.trim();
    if (!trimmedHref) {
      setError("Enter a link URL.");
      return;
    }

    restoreSelection();
    if (!applyLink(editor, trimmedHref)) {
      setError("Enter a valid link URL.");
      return;
    }

    closeAndReturnToEditor();
  }

  function removeLink() {
    restoreSelection();
    editor.chain().extendMarkRange("link").unsetLink().run();
    closeAndReturnToEditor();
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger
        aria-label="Link"
        aria-pressed={active}
        className={toolbarButtonClass(active)}
        title="Link"
        type="button"
      >
        <Link className="size-[18px]" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align="start" className="z-50" sideOffset={6}>
          <Popover.Popup
            className="w-72 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-md outline-none"
            finalFocus={() => (returnFocusToEditorRef.current ? editor.view.dom : true)}
            initialFocus={inputRef}
          >
            <form className="space-y-3" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" htmlFor={inputId}>
                  Link URL
                </label>
                <input
                  aria-invalid={error ? true : undefined}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20 aria-invalid:border-destructive aria-invalid:ring-destructive/20"
                  id={inputId}
                  inputMode="url"
                  onChange={(event) => {
                    setHref(event.target.value);
                    setError(null);
                  }}
                  placeholder="https://example.com"
                  ref={inputRef}
                  value={href}
                />
                {error && (
                  <p className="text-xs text-destructive" role="alert">
                    {error}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <div>
                  {active && (
                    <Button size="xs" type="button" variant="destructive" onClick={removeLink}>
                      Remove
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="xs" type="button" variant="ghost" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button disabled={!href.trim()} size="xs" type="submit">
                    Apply
                  </Button>
                </div>
              </div>
            </form>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function ToolbarButton(props: {
  active?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={props.label}
      aria-pressed={props.active}
      className={toolbarButtonClass(props.active ?? false)}
      onMouseDown={(event) => event.preventDefault()}
      onClick={props.onClick}
      title={props.label}
      type="button"
    >
      {props.children}
    </button>
  );
}

function toolbarButtonClass(active: boolean): string {
  return `inline-flex h-8 w-8 items-center justify-center rounded ${
    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-background"
  }`;
}
