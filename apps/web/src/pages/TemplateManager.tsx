import { useEffect, useRef, useState } from "react";
import { Button } from "../components/ui/button.js";
import { Panel, PanelHeader } from "../components/link2cv/panel.js";
import TemplateVariableMapping from "../components/TemplateVariableMapping.js";
import { profilesApi } from "../api/profiles.js";
import type { ApiDocumentTemplate, ApiProfile } from "../api/types.js";
import { cn } from "../lib/utils.js";
import { FileText, Upload, Check, MoreHorizontal } from "lucide-react";

export default function TemplateManager() {
  const [templates, setTemplates] = useState<ApiDocumentTemplate[]>([]);
  const [profile, setProfile] = useState<ApiProfile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !profile) return;
    try {
      setError(null);
      const uploaded = await profilesApi.uploadDocumentTemplate(profile.id, file);
      setTemplates((prev) => [...prev, uploaded]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
  }

  async function handleSetDefault(templateId: string) {
    if (!profile) return;
    try {
      setError(null);
      await profilesApi.setDefaultDocumentTemplate(profile.id, templateId);
      setTemplates((prev) => prev.map((t) => ({ ...t, isDefault: t.id === templateId })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to set default.");
    }
  }

  const cvTemplates = templates.filter((t) => t.kind === "cv");
  const letterTemplates: ApiDocumentTemplate[] = [];

  if (isLoading)
    return <div className="py-16 text-center text-muted-foreground">Loading templates...</div>;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-destructive/20 bg-danger-soft p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <Panel className="p-6">
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Upload className="size-5" />
          </div>
          <p className="mt-4 text-sm font-medium text-foreground">
            Upload a CV or cover letter template
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Drag and drop a DOCX or PDF file, or browse. Use the variable mapping section to connect
            your profile data to template placeholders.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <span>Browse files</span>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.pdf"
            onChange={handleUpload}
            className="hidden"
          />
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TemplateGroup
          title="CV templates"
          templates={cvTemplates}
          profile={profile}
          onSetDefault={handleSetDefault}
        />
        <TemplateGroup
          title="Cover letter templates"
          templates={letterTemplates}
          profile={profile}
          onSetDefault={handleSetDefault}
        />
      </div>
    </div>
  );
}

function TemplateGroup({
  title,
  templates,
  profile,
  onSetDefault,
}: {
  title: string;
  templates: ApiDocumentTemplate[];
  profile: ApiProfile | null;
  onSetDefault: (id: string) => void;
}) {
  return (
    <Panel>
      <PanelHeader title={title} />
      <div className="divide-y divide-border border-t border-border">
        {templates.length > 0 ? (
          templates.map((t) => (
            <TemplateCard key={t.id} template={t} profile={profile} onSetDefault={onSetDefault} />
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
}: {
  template: ApiDocumentTemplate;
  profile: ApiProfile | null;
  onSetDefault: (id: string) => void;
}) {
  const [showMapping, setShowMapping] = useState(false);

  return (
    <div>
      <div className="flex items-center gap-3.5 px-5 py-4">
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
          </div>
          <p className="text-xs text-muted-foreground">
            {template.format.toUpperCase()} · {template.placeholders.length} variable{template.placeholders.length !== 1 ? "s" : ""} · {new Date(template.updatedAt).toLocaleDateString()}
          </p>
        </div>
        <button
          onClick={() => onSetDefault(template.id)}
          className={cn(
            "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
            template.isDefault ? "text-muted-foreground/50" : "text-primary hover:bg-accent",
          )}
          disabled={template.isDefault}
        >
          {template.isDefault ? "In use" : "Set default"}
        </button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={showMapping ? "Hide variable mapping" : "Show variable mapping"}
          onClick={() => setShowMapping(!showMapping)}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </div>

      {showMapping && profile && (
        <TemplateVariableMapping template={template} profile={profile} />
      )}
    </div>
  );
}
