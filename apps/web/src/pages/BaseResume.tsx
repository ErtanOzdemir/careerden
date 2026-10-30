import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  emptyRichDocument,
  listHtmlTemplates,
  renderHtmlTemplate,
  richDocumentFromText,
} from "@careerden/contracts";
import { Check, Info, Loader2 } from "lucide-react";
import { profilesApi } from "../api/profiles.js";
import type { ApiDocumentContent, ApiProfile } from "../api/types.js";
import { Panel } from "../components/careerden/panel.js";
import { TemplateThumbnail } from "../components/TemplateThumbnail.js";
import { Button } from "../components/ui/button.js";
import { buildPreviewTemplateData } from "../lib/document-preview.js";
import { renderPagedPreview } from "../lib/paged-preview.js";
import { sampleResumeProfile } from "../lib/sample-resume-profile.js";
import { cn } from "../lib/utils.js";

const cvTemplates = listHtmlTemplates("cv");
const fallbackTemplateId = cvTemplates[0]?.id ?? "cv.default";
// A4 at 96 CSS px/inch (210mm), matching the PDF page width Playwright renders.
const pageWidthPx = 794;
const previewPaddingPx = 64;

function hasResumeContent(profile: ApiProfile): boolean {
  return Boolean(profile.fullName.trim()) && profile.experience.length > 0;
}

function baseContentFor(profile: ApiProfile): ApiDocumentContent {
  return {
    customizedSummary:
      profile.summaryRichText ??
      (profile.summary ? richDocumentFromText(profile.summary) : emptyRichDocument()),
    experienceEnhancements: [],
    skillSuggestions: [],
    educationEnhancements: [],
    projectEnhancements: [],
    certificationSuggestions: [],
  };
}

export default function BaseResume() {
  const [profile, setProfile] = useState<ApiProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    profilesApi
      .me()
      .then((p) => {
        if (isMounted) setProfile(p);
      })
      .catch((loadError) => {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load profile.");
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const defaultId =
    cvTemplates.find((template) => template.id === profile?.defaultCvTemplateId)?.id ??
    fallbackTemplateId;
  const activeId = selectedId ?? defaultId;
  const activeTemplate = cvTemplates.find((template) => template.id === activeId);
  const usesSample = !profile || !hasResumeContent(profile);

  const templateData = useMemo(() => {
    const source = profile && hasResumeContent(profile) ? profile : sampleResumeProfile;
    return buildPreviewTemplateData(source, baseContentFor(source));
  }, [profile]);

  const htmlById = useMemo(
    () =>
      Object.fromEntries(
        cvTemplates.map((template) => [template.id, renderHtmlTemplate(template.id, templateData)]),
      ),
    [templateData],
  );

  async function handleUseAsDefault() {
    if (!profile) return;
    setIsSaving(true);
    setError(null);
    try {
      setProfile(await profilesApi.update(profile.id, { defaultCvTemplateId: activeId }));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save the template.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {!isLoading && usesSample && (
        <Panel className="flex items-start gap-3 border-info/20 bg-info-soft/40 px-5 py-4">
          <Info className="mt-0.5 size-4 shrink-0 text-info" />
          <p className="text-sm text-muted-foreground">
            Showing sample content. Add your name and experience in your{" "}
            <Link
              className="font-medium text-foreground underline-offset-4 hover:underline"
              to="/profile"
            >
              career profile
            </Link>{" "}
            to preview each layout with your own details.
          </p>
        </Panel>
      )}
      {error && (
        <p className="rounded-lg bg-danger-soft px-4 py-2.5 text-sm text-destructive">{error}</p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <BaseResumePreview
          action={
            activeId === defaultId && profile?.defaultCvTemplateId ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success">
                <Check className="size-3" /> Default
              </span>
            ) : (
              <Button
                disabled={!profile || isSaving}
                onClick={() => void handleUseAsDefault()}
                size="sm"
              >
                {isSaving && <Loader2 className="animate-spin" />}
                Use as default
              </Button>
            )
          }
          html={htmlById[activeId]}
          title={activeTemplate?.name ?? "Template"}
        />

        {/* h-0 keeps the list out of the row's sizing, so the panel matches the preview's
            height and scrolls its templates instead of growing past it. */}
        <Panel className="flex flex-col lg:h-0 lg:min-h-full">
          <div className="shrink-0 px-5 pt-4 pb-3">
            <h2 className="text-sm font-semibold text-foreground">Templates</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tailored CVs start from your default layout.
            </p>
          </div>
          <div
            className="scrollbar-soft grid min-h-0 flex-1 grid-cols-2 content-start gap-x-3 gap-y-4 overflow-y-auto border-t border-border px-5 py-4"
            data-testid="base-resume-templates"
          >
            {cvTemplates.map((template) => {
              const isActive = template.id === activeId;
              const isDefault = template.id === defaultId;
              return (
                <button
                  aria-pressed={isActive}
                  className="group text-left"
                  key={template.id}
                  onClick={() => setSelectedId(template.id)}
                  title={template.description}
                  type="button"
                >
                  <div
                    className={cn(
                      "overflow-hidden rounded-lg border shadow-xs transition-all",
                      isActive
                        ? "border-primary ring-2 ring-ring/40"
                        : "border-border group-hover:border-foreground/30",
                    )}
                  >
                    <TemplateThumbnail html={htmlById[template.id] ?? ""} title={template.name} />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-1">
                    <span
                      className={cn(
                        "truncate text-xs",
                        isActive ? "font-semibold text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {template.name}
                    </span>
                    {isDefault && (
                      <span className="shrink-0 text-[0.65rem] text-muted-foreground">In use</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function BaseResumePreview({
  action,
  html,
  title,
}: {
  action: React.ReactNode;
  html?: string;
  title: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const renderIdRef = useRef(0);
  const [zoom, setZoom] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    function applyFitZoom() {
      if (!scrollArea) return;
      const availableWidth = scrollArea.clientWidth - previewPaddingPx;
      if (availableWidth > 0) {
        setZoom(Math.round(Math.min(1, availableWidth / pageWidthPx) * 100) / 100);
      }
    }

    applyFitZoom();
    const observer = new ResizeObserver(applyFitZoom);
    observer.observe(scrollArea);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !html) return;

    const renderId = ++renderIdRef.current;
    setIsRendering(true);
    const handle = renderPagedPreview(html, container);
    void handle.result.then(({ totalPages }) => {
      if (renderIdRef.current === renderId) {
        setPageCount(totalPages);
        setIsRendering(false);
      }
    });

    return () => handle.cancel();
  }, [html]);

  return (
    <Panel className="min-w-0 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {isRendering && <Loader2 className="size-3 animate-spin" />}
            A4
            {!isRendering && pageCount > 0 && ` · ${pageCount} page${pageCount === 1 ? "" : "s"}`}
          </p>
        </div>
        {action}
      </div>
      <div
        className="scrollbar-soft h-[calc(100vh-14rem)] min-h-[32rem] overflow-auto bg-muted/50 p-8"
        data-testid="base-resume-preview"
        ref={scrollAreaRef}
      >
        <div className="mx-auto" ref={containerRef} style={{ width: pageWidthPx, zoom }} />
      </div>
    </Panel>
  );
}
