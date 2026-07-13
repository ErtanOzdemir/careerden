import type { RichDocument } from "../api/types";
import RichTextEditor, { RichTextViewer } from "./RichTextEditor";
import { SelectionToggle } from "./link2cv/selection-toggle";
import { useState } from "react";

const aiOptions = [
  { value: "ai" as const, label: "AI Enhanced" },
  { value: "original" as const, label: "Original" },
];

export interface EnhancedFieldRowProps {
  label: string;
  original: string;
  originalRichText?: RichDocument;
  enhanced?: RichDocument;
  selection?: "ai" | "original";
  onSelectionChange: (selection: "ai" | "original") => void;
  onSave: (content: RichDocument) => void;
}

export default function EnhancedFieldRow({
  label,
  original,
  originalRichText,
  enhanced,
  selection = "ai",
  onSelectionChange,
  onSave,
}: EnhancedFieldRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<RichDocument | undefined>(enhanced);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{label}</h4>
        <SelectionToggle value={selection} onChange={onSelectionChange} options={aiOptions} />
      </div>
      {selection === "ai" && enhanced ? (
        isEditing ? (
          <div>
            <RichTextEditor
              ariaLabel={`Edit ${label}`}
              value={draft ?? enhanced}
              onChange={(value) => setDraft(value)}
            />
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                className="px-3 py-1 bg-primary text-primary-foreground rounded-full text-xs font-semibold"
                onClick={() => {
                  if (draft) {
                    onSave(draft);
                    setIsEditing(false);
                  }
                }}
              >
                Save
              </button>
              <button
                type="button"
                className="px-3 py-1 bg-muted text-foreground rounded-full text-xs font-semibold"
                onClick={() => {
                  setDraft(enhanced);
                  setIsEditing(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => setIsEditing(true)}
            className="cursor-pointer border border-transparent hover:border-border rounded-lg p-4 transition-colors"
          >
            <RichTextViewer ariaLabel={label} value={enhanced} />
          </div>
        )
      ) : (
        <div className="bg-muted rounded-lg p-4 text-xs text-muted-foreground">
          {originalRichText ? (
            <RichTextViewer ariaLabel={`Original ${label}`} value={originalRichText} />
          ) : (
            original || "No original content available."
          )}
        </div>
      )}
    </div>
  );
}
