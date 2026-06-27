import { useEffect, useRef, useState } from "react";
import { Button } from "../components/ui/button.js";
import { Panel, PanelHeader } from "../components/link2cv/panel.js";
import { profilesApi } from "../api/profiles.js";
import type { ApiDocumentTemplate } from "../api/types.js";
import { cn } from "../lib/utils.js";
import { FileText, Upload, Check, MoreHorizontal, FileType2 } from "lucide-react";

const variables = [
  { token: "{{full_name}}", label: "Full name" },
  { token: "{{role_title}}", label: "Target role title" },
  { token: "{{company_name}}", label: "Company name" },
  { token: "{{summary}}", label: "Professional summary" },
  { token: "{{key_skills}}", label: "Matched skills" },
  { token: "{{experience}}", label: "Experience block" },
];

export default function TemplateManager() {
  const [templates, setTemplates] = useState<ApiDocumentTemplate[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    profilesApi
      .me()
      .then(async (p) => {
        if (!isMounted) return;
        setProfileId(p.id);
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
    if (!file || !profileId) return;
    try {
      setError(null);
      const uploaded = await profilesApi.uploadDocumentTemplate(profileId, file);
      setTemplates((prev) => [...prev, uploaded]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
  }

  async function handleSetDefault(templateId: string) {
    if (!profileId) return;
    try {
      setError(null);
      await profilesApi.setDefaultDocumentTemplate(profileId, templateId);
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
            Drag and drop a DOCX or PDF file, or browse. Use variables below so Link2CV can fill in
            tailored content.
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
          onSetDefault={handleSetDefault}
        />
        <TemplateGroup
          title="Cover letter templates"
          templates={letterTemplates}
          onSetDefault={handleSetDefault}
        />
      </div>

      <Panel>
        <PanelHeader
          title="Variable mapping"
          action={
            <span className="text-xs text-muted-foreground">Insert these into your templates</span>
          }
        />
        <div className="grid grid-cols-1 gap-px border-t border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {variables.map((v) => (
            <div
              key={v.token}
              className="flex items-center justify-between gap-3 bg-card px-5 py-3"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{v.label}</p>
                <code className="text-xs text-muted-foreground">{v.token}</code>
              </div>
              <FileType2 className="size-4 text-muted-foreground/60" />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function TemplateGroup({
  title,
  templates,
  onSetDefault,
}: {
  title: string;
  templates: ApiDocumentTemplate[];
  onSetDefault: (id: string) => void;
}) {
  return (
    <Panel>
      <PanelHeader title={title} />
      <div className="divide-y divide-border border-t border-border">
        {templates.length > 0 ? (
          templates.map((t) => (
            <div key={t.id} className="flex items-center gap-3.5 px-5 py-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <FileText className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{t.fileName}</p>
                  {t.isDefault && (
                    <span className="flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[0.7rem] font-medium text-success">
                      <Check className="size-3" />
                      Default
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.format.toUpperCase()} · {new Date(t.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => onSetDefault(t.id)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                  t.isDefault ? "text-muted-foreground/50" : "text-primary hover:bg-accent",
                )}
                disabled={t.isDefault}
              >
                {t.isDefault ? "In use" : "Set default"}
              </button>
              <Button variant="ghost" size="icon-sm" aria-label="More options">
                <MoreHorizontal className="size-4" />
              </Button>
            </div>
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
