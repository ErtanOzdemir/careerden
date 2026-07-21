import { useEffect, useRef, useState } from "react";
import { Button } from "../components/ui/button.js";
import { ConfirmDialog } from "../components/ui/confirm-dialog.js";
import { Panel, PanelHeader } from "../components/careerden/panel.js";
import TemplateVariableMapping from "../components/TemplateVariableMapping.js";
import { profilesApi } from "../api/profiles.js";
import type { ApiDocumentTemplate, ApiProfile } from "../api/types.js";
import { hasValidCoverLetterTemplateMapping } from "../lib/document-template.js";
import { cn } from "../lib/utils.js";
import { Check, ChevronDown, FileText, Upload } from "lucide-react";

export default function TemplateManager() {
  const [templates, setTemplates] = useState<ApiDocumentTemplate[]>([]);
  const [profile, setProfile] = useState<ApiProfile | null>(null);
  const cvFileInputRef = useRef<HTMLInputElement>(null);
  const coverLetterFileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<ApiDocumentTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    profilesApi
      .me()
      .then(async (p) => {
        if (!isMounted) return;
        setProfile(p);
        const t = await profilesApi.listDocumentTemplates(p.id);
        if (isMounted) setTemplates(t);
      })
      .catch((e) => {
        if (isMounted) setError(e.message);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  async function handleUpload(
    kind: ApiDocumentTemplate["kind"],
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file || !profile) return;
    try {
      setError(null);
      const uploaded = await profilesApi.uploadDocumentTemplate(profile.id, kind, file);
      setTemplates((prev) => [...prev, uploaded]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      event.target.value = "";
    }
  }

  async function handleSetDefault(templateId: string) {
    if (!profile) return;
    try {
      setError(null);
      await profilesApi.setDefaultDocumentTemplate(profile.id, templateId);
      setTemplates((prev) => {
        const selected = prev.find((template) => template.id === templateId);
        return prev.map((template) =>
          selected && template.kind === selected.kind
            ? { ...template, isDefault: template.id === templateId }
            : template,
        );
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to set default.");
    }
  }

  async function handleDeleteTemplate() {
    if (!profile || !templateToDelete) return;

    try {
      setIsDeleting(true);
      setDeleteError(null);
      await profilesApi.deleteDocumentTemplate(profile.id, templateToDelete.id);
      setTemplates((previous) =>
        previous.filter((template) => template.id !== templateToDelete.id),
      );
      setTemplateToDelete(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete template.");
    } finally {
      setIsDeleting(false);
    }
  }

  function openDeleteDialog(template: ApiDocumentTemplate) {
    setDeleteError(null);
    setTemplateToDelete(template);
  }

  const cvTemplates = templates.filter((t) => t.kind === "cv");
  const letterTemplates = templates.filter((t) => t.kind === "cover_letter");

  function handleTemplateUpdated(updated: ApiDocumentTemplate) {
    setTemplates((previous) =>
      previous.map((template) => (template.id === updated.id ? updated : template)),
    );
  }

  if (isLoading)
    return <div className="py-16 text-center text-muted-foreground">Loading templates...</div>;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-destructive/20 bg-danger-soft p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TemplateUpload
          description="Upload a DOCX CV template and map its placeholders to your profile data."
          inputRef={cvFileInputRef}
          label="Upload CV template"
          onChange={(event) => handleUpload("cv", event)}
        />
        <TemplateUpload
          description="Upload a DOCX cover-letter template, then map one placeholder to Content."
          inputRef={coverLetterFileInputRef}
          label="Upload cover letter template"
          onChange={(event) => handleUpload("cover_letter", event)}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TemplateGroup
          title="CV templates"
          templates={cvTemplates}
          profile={profile}
          onSetDefault={handleSetDefault}
          onDelete={openDeleteDialog}
          onTemplateUpdated={handleTemplateUpdated}
        />
        <TemplateGroup
          title="Cover letter templates"
          templates={letterTemplates}
          profile={profile}
          onSetDefault={handleSetDefault}
          onDelete={openDeleteDialog}
          onTemplateUpdated={handleTemplateUpdated}
        />
      </div>

      <ConfirmDialog
        confirmLabel="Delete template"
        description="The template file and its variable mappings will be permanently removed. Existing generated documents will remain available, and saved selections will return to the default layout."
        error={deleteError}
        isPending={isDeleting}
        onConfirm={() => void handleDeleteTemplate()}
        onOpenChange={(open) => {
          if (!open) {
            setTemplateToDelete(null);
            setDeleteError(null);
          }
        }}
        open={templateToDelete !== null}
        title={`Delete ${templateToDelete?.fileName ?? "template"}?`}
      />
    </div>
  );
}

function TemplateUpload({
  description,
  inputRef,
  label,
  onChange,
}: {
  description: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  label: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <Panel className="p-6">
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-6 py-8 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Upload className="size-5" />
        </div>
        <p className="mt-4 text-sm font-medium text-foreground">{label}</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
        <Button
          className="mt-4"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          Browse DOCX
        </Button>
        <input ref={inputRef} type="file" accept=".docx" onChange={onChange} className="hidden" />
      </div>
    </Panel>
  );
}

function TemplateGroup({
  title,
  templates,
  profile,
  onSetDefault,
  onDelete,
  onTemplateUpdated,
}: {
  title: string;
  templates: ApiDocumentTemplate[];
  profile: ApiProfile | null;
  onSetDefault: (id: string) => void;
  onDelete: (template: ApiDocumentTemplate) => void;
  onTemplateUpdated: (template: ApiDocumentTemplate) => void;
}) {
  return (
    <Panel>
      <PanelHeader title={title} />
      <div className="divide-y divide-border border-t border-border">
        {templates.length > 0 ? (
          templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              profile={profile}
              onSetDefault={onSetDefault}
              onDelete={onDelete}
              onTemplateUpdated={onTemplateUpdated}
            />
          ))
        ) : (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            No {title.toLowerCase()} yet.
          </div>
        )}
      </div>
    </Panel>
  );
}

function TemplateCard({
  template,
  profile,
  onSetDefault,
  onDelete,
  onTemplateUpdated,
}: {
  template: ApiDocumentTemplate;
  profile: ApiProfile | null;
  onSetDefault: (id: string) => void;
  onDelete: (template: ApiDocumentTemplate) => void;
  onTemplateUpdated: (template: ApiDocumentTemplate) => void;
}) {
  const [showMapping, setShowMapping] = useState(false);
  const hasRequiredMapping = template.kind === "cv" || hasValidCoverLetterTemplateMapping(template);

  return (
    <div>
      <button
        type="button"
        aria-expanded={showMapping}
        aria-label={`${showMapping ? "Close" : "Edit"} variable mappings for ${template.fileName}`}
        className="flex w-full items-center gap-3.5 px-5 py-4 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        onClick={() => setShowMapping((current) => !current)}
      >
        <div className="flex size-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
          <FileText className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">{template.fileName}</p>
            {template.isDefault && (
              <span className="flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[0.7rem] font-medium text-success">
                <Check className="size-3" />
                Default
              </span>
            )}
            {!hasRequiredMapping && (
              <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[0.7rem] font-medium text-warning">
                Mapping required
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {template.format.toUpperCase()} · {template.placeholders.length} variable
            {template.placeholders.length !== 1 ? "s" : ""} ·{" "}
            {new Date(template.updatedAt).toLocaleDateString()}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            showMapping && "rotate-180",
          )}
        />
      </button>

      {showMapping && (
        <>
          {profile && (
            <TemplateVariableMapping
              template={template}
              profile={profile}
              onUpdated={onTemplateUpdated}
            />
          )}
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-muted/20 px-5 py-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSetDefault(template.id)}
              disabled={template.isDefault || !hasRequiredMapping}
              title={
                !hasRequiredMapping
                  ? "Map a Content placeholder before using this template"
                  : undefined
              }
            >
              {template.isDefault ? "Default template" : "Set as default"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Delete template ${template.fileName}`}
              className="text-destructive hover:bg-danger-soft hover:text-destructive"
              onClick={() => onDelete(template)}
            >
              Delete template
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
