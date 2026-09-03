import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { ApiApplicationPackPreferences, ApiDocumentContent, ApiProfile } from "../api/types.js";
import type { HtmlTemplateDefinition } from "@careerden/contracts";
import { renderHtmlTemplate } from "@careerden/contracts";
import type { GeneratedApplicationDocument, JobApplication } from "../types.js";
import { cn } from "../lib/utils.js";
import { buildPreviewTemplateData } from "../lib/document-preview.js";
import { renderPagedPreview } from "../lib/paged-preview.js";
import { ApplicationPackCustomizer } from "./ApplicationPackCustomizer.js";
import { TipsPanel } from "./TipsPanel.js";
import { Button, buttonVariants } from "./ui/button.js";
import {
  AlertTriangle,
  Check,
  Download,
  FileText,
  Loader2,
  Minus,
  Plus,
  Sparkles,
  UserRound,
} from "lucide-react";

interface ApplicationPackWorkspaceProps {
  app: JobApplication;
  readOnly?: boolean;
  profile?: ApiProfile;
  templates: HtmlTemplateDefinition[];
  isUpdating: boolean;
  downloadingId: string | null;
  onDownload: (documentId: string) => Promise<void>;
  onUpdate: (
    documentContent: ApiDocumentContent,
    preferences: ApiApplicationPackPreferences,
  ) => Promise<void>;
}

const defaultPreferences: ApiApplicationPackPreferences = {
  language: "auto",
  tone: "professional",
};

export function ApplicationPackWorkspace({
  app,
  readOnly = false,
  profile,
  templates,
  isUpdating,
  downloadingId,
  onDownload,
  onUpdate,
}: ApplicationPackWorkspaceProps) {
  const [draftContent, setDraftContent] = useState(app.documentContent);
  const [preferences, setPreferences] = useState(
    app.applicationPackPreferences ?? defaultPreferences,
  );
  const [activeKind, setActiveKind] = useState<"cover_letter" | "cv">("cv");
  const [zoom, setZoom] = useState(1);
  const [isDownloadingBoth, setIsDownloadingBoth] = useState(false);
  const [pendingHighlight, setPendingHighlight] = useState<string | null>(null);

  const documents = useMemo(() => groupDocuments(app.generatedDocuments ?? []), [app]);

  useEffect(() => {
    setDraftContent(app.documentContent);
    setPreferences(app.applicationPackPreferences ?? defaultPreferences);
  }, [app.applicationPackPreferences, app.documentContent, app.id]);

  const cvTemplateId = resolveTemplateId(templates, "cv", preferences.cvTemplateId, profile);
  const coverLetterTemplateId = resolveTemplateId(
    templates,
    "cover_letter",
    preferences.coverLetterTemplateId,
    profile,
  );

  const liveHtml = useMemo(() => {
    if (!draftContent) return null;
    const data = buildPreviewTemplateData(profile, draftContent);
    return {
      cv: cvTemplateId ? renderHtmlTemplate(cvTemplateId, data) : "",
      coverLetter: coverLetterTemplateId ? renderHtmlTemplate(coverLetterTemplateId, data) : "",
    };
  }, [draftContent, profile, cvTemplateId, coverLetterTemplateId]);

  const readiness = app.profileReadiness;
  const canUpdate =
    !readOnly &&
    Boolean(app.aiMatch && draftContent) &&
    readiness?.state !== "blocked" &&
    ["completed", "failed", "review_ready"].includes(app.processingStatus ?? "");
  const pdfDocuments = [documents.cv.pdf, documents.cover_letter.pdf].filter(
    (document): document is GeneratedApplicationDocument => Boolean(document),
  );

  async function handleUpdate() {
    if (!draftContent || !canUpdate) return;
    await onUpdate(draftContent, preferences);
  }

  function handleContentChange(content: ApiDocumentContent) {
    setDraftContent(content);
  }

  function handleTipApplied(fieldDomId: string) {
    // Tips only ever target CV fields (cover letter is untouched by this feature) — switch tabs so
    // the highlight is actually visible, and let the preview's own render effect fire the highlight
    // once the content-change-triggered re-render settles (see DocumentPreviewCard below).
    setActiveKind("cv");
    setPendingHighlight(fieldDomId);
  }

  function handlePreferencesChange(nextPreferences: ApiApplicationPackPreferences) {
    setPreferences(nextPreferences);
  }

  async function handleDownloadBoth() {
    if (pdfDocuments.length === 0) return;
    setIsDownloadingBoth(true);
    try {
      await Promise.all(pdfDocuments.map((document) => onDownload(document.id)));
    } finally {
      setIsDownloadingBoth(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-4 border-b border-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Sparkles className="size-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Application pack</h2>
                <p className="text-sm text-muted-foreground">
                  One tailored CV and cover letter for this role.
                </p>
              </div>
            </div>
          </div>
          <PackStatus status={app.processingStatus} />
        </div>
        <PackProgress status={app.processingStatus} hasDocuments={pdfDocuments.length > 0} />
      </section>

      {readiness?.state === "blocked" && (
        <section className="flex flex-col gap-4 rounded-xl border border-warning/30 bg-warning-soft p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning-emphasis" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">Complete your profile first</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Add positioning, skills, or career evidence so the generated documents stay factual
                and useful.
              </p>
            </div>
          </div>
          <Link className={buttonVariants({ variant: "outline" })} to="/profile">
            <UserRound className="size-3.5" /> Edit profile
          </Link>
        </section>
      )}

      {readiness?.state === "warning" && (
        <section className="flex items-start gap-3 rounded-xl border border-warning/20 bg-warning-soft/60 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-emphasis" />
          <p className="text-sm text-muted-foreground">
            Your pack is ready to use, but adding {formatReadinessWarnings(readiness.warnings)} may
            improve future tailoring.
          </p>
        </section>
      )}

      {app.aiMatch && <MatchSnapshot app={app} />}

      <div className="grid gap-5 lg:grid-cols-[20rem_1fr] lg:items-start">
        <TipsPanel
          aiMatch={app.aiMatch}
          content={draftContent}
          jobApplicationId={app.id}
          onContentChange={handleContentChange}
          onTipApplied={handleTipApplied}
          profile={profile}
          readOnly={readOnly}
        />

        <div className="min-w-0 space-y-5">
          <DocumentPreviewCard
            activeKind={activeKind}
            documents={documents[activeKind]}
            downloadingId={downloadingId}
            html={activeKind === "cv" ? liveHtml?.cv : liveHtml?.coverLetter}
            onActiveKindChange={setActiveKind}
            onDownload={onDownload}
            onHighlightConsumed={() => setPendingHighlight(null)}
            onZoomChange={setZoom}
            pendingHighlight={pendingHighlight}
            zoom={zoom}
          />

          {!readOnly && app.aiMatch && draftContent && (
            <ApplicationPackCustomizer
              content={draftContent}
              onContentChange={handleContentChange}
              onPreferencesChange={handlePreferencesChange}
              preferences={preferences}
              profile={profile}
              templates={templates}
            />
          )}

          <section className="flex flex-col gap-3 rounded-xl border border-border bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{packActionDescription(app)}</p>
              <p className="text-xs text-muted-foreground">
                {readOnly
                  ? "Restore this application to customize or regenerate its pack."
                  : "Updates run in the background; you can leave this page safely."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {pdfDocuments.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => void handleDownloadBoth()}
                  disabled={isDownloadingBoth}
                >
                  <Download className="size-3.5" />
                  {isDownloadingBoth ? "Preparing..." : "Download both PDFs"}
                </Button>
              )}
              {!readOnly && (
                <Button onClick={() => void handleUpdate()} disabled={!canUpdate || isUpdating}>
                  {isUpdating ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                  {app.generatedDocuments?.length ? "Update pack" : "Create pack"}
                </Button>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function resolveTemplateId(
  templates: HtmlTemplateDefinition[],
  kind: "cv" | "cover_letter",
  overrideId: string | undefined,
  profile?: ApiProfile,
): string | undefined {
  const defaultId =
    kind === "cv" ? profile?.defaultCvTemplateId : profile?.defaultCoverLetterTemplateId;
  const candidates = [overrideId, defaultId];
  for (const candidate of candidates) {
    const template = candidate && templates.find((item) => item.id === candidate);
    if (template && template.kind === kind) return template.id;
  }

  return templates.find((item) => item.kind === kind)?.id;
}

function MatchSnapshot({ app }: { app: JobApplication }) {
  const match = app.aiMatch!;
  const requirements = match.requirements ?? [];

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="grid gap-5 lg:grid-cols-[12rem_1fr]">
        <div className="rounded-xl bg-muted/50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Role match
          </p>
          <p className="mt-2 text-4xl font-semibold tracking-tight text-foreground">
            {match.score}%
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {match.recommendation}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Why this pack is tailored</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{match.summary}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {requirements.slice(0, 6).map((requirement) => (
              <span
                key={requirement.requirement}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium",
                  requirement.status === "matched" &&
                    "border-success/30 bg-success-soft text-success",
                  requirement.status === "partial" &&
                    "border-warning/30 bg-warning-soft text-warning-emphasis",
                  requirement.status === "missing" &&
                    "border-destructive/20 bg-danger-soft text-destructive",
                )}
              >
                {requirement.requirement}
              </span>
            ))}
          </div>
          {requirements.length > 0 && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer font-medium text-foreground">
                View match evidence
              </summary>
              <div className="mt-3 space-y-3 border-l border-border pl-4">
                {requirements.map((requirement) => (
                  <div key={requirement.requirement}>
                    <p className="font-medium text-foreground">{requirement.requirement}</p>
                    <p className="text-xs text-muted-foreground">
                      {requirement.evidence.join(" · ") || "No supporting profile evidence yet."}
                    </p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    </section>
  );
}

const minZoom = 0.4;
const maxZoom = 2.5;
const zoomStepSize = 0.1;
const pagedPreviewDebounceMs = 250;
// A4 at 96 CSS px/inch (210mm), matching the PDF page width Playwright renders.
const pageWidthPx = 794;

function DocumentPreviewCard({
  activeKind,
  documents,
  html,
  downloadingId,
  onHighlightConsumed,
  pendingHighlight,
  zoom,
  onActiveKindChange,
  onDownload,
  onZoomChange,
}: {
  activeKind: "cover_letter" | "cv";
  documents: DocumentFormats;
  html?: string;
  downloadingId: string | null;
  onHighlightConsumed: () => void;
  pendingHighlight: string | null;
  zoom: number;
  onActiveKindChange: (kind: "cover_letter" | "cv") => void;
  onDownload: (documentId: string) => Promise<void>;
  onZoomChange: (zoom: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const renderIdRef = useRef(0);
  const [pageCount, setPageCount] = useState(0);
  const [isRendering, setIsRendering] = useState(false);
  const hasDocument = Boolean(documents.pdf);

  function clampZoom(value: number): number {
    return Math.min(maxZoom, Math.max(minZoom, value));
  }

  // Auto-shrink the page to fit the scroll area's current width (e.g. once the tips panel takes
  // up space beside it) unless the user has manually zoomed, in which case their choice sticks.
  const hasUserZoomedRef = useRef(false);
  const onZoomChangeRef = useRef(onZoomChange);
  onZoomChangeRef.current = onZoomChange;
  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    function applyFitZoom() {
      if (hasUserZoomedRef.current || !scrollArea) return;
      const scrollAreaHorizontalPaddingPx = 64;
      const availableWidth = scrollArea.clientWidth - scrollAreaHorizontalPaddingPx;
      if (availableWidth <= 0) return;
      const fitZoom = clampZoom(Math.min(1, availableWidth / pageWidthPx));
      onZoomChangeRef.current(Math.round(fitZoom * 100) / 100);
    }

    applyFitZoom();
    const observer = new ResizeObserver(applyFitZoom);
    observer.observe(scrollArea);
    return () => observer.disconnect();
  }, []);

  // Read via a ref inside the render effect below rather than depending on it directly — a new
  // highlight request shouldn't tear down and restart an in-flight (or already-settled) render, it
  // should just fire once the *current* one is ready.
  const pendingHighlightRef = useRef(pendingHighlight);
  useEffect(() => {
    pendingHighlightRef.current = pendingHighlight;
  }, [pendingHighlight]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !html) {
      setPageCount(0);
      return;
    }

    const renderId = ++renderIdRef.current;
    let handle: ReturnType<typeof renderPagedPreview> | null = null;
    setIsRendering(true);
    const timer = setTimeout(() => {
      handle = renderPagedPreview(html, container);
      void handle.result.then(({ totalPages }) => {
        if (renderIdRef.current === renderId) {
          setPageCount(totalPages);
          setIsRendering(false);
          if (pendingHighlightRef.current) {
            handle?.highlightField(pendingHighlightRef.current);
            onHighlightConsumed();
          }
        }
      });
    }, pagedPreviewDebounceMs);

    return () => {
      clearTimeout(timer);
      handle?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onHighlightConsumed is stable per render cycle; including it would re-run this effect on every highlight consumption
  }, [html]);

  function stepZoom(direction: 1 | -1) {
    hasUserZoomedRef.current = true;
    onZoomChange(clampZoom(Math.round((zoom + direction * zoomStepSize) * 100) / 100));
  }

  function handleWheelZoom(event: React.WheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    hasUserZoomedRef.current = true;
    onZoomChange(clampZoom(zoom - event.deltaY * 0.0015));
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
          {(["cv", "cover_letter"] as const).map((kind) => (
            <button
              aria-pressed={activeKind === kind}
              className={cn(
                "rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
                activeKind === kind
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              key={kind}
              onClick={() => onActiveKindChange(kind)}
              type="button"
            >
              {kind === "cv" ? "Tailored CV" : "Cover letter"}
            </button>
          ))}
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-1 text-[0.7rem] font-medium",
            hasDocument ? "bg-success-soft text-success" : "bg-muted text-muted-foreground",
          )}
        >
          {hasDocument ? "Ready" : "Pending"}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/20 px-5 py-2.5">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {isRendering && <Loader2 className="size-3 animate-spin" />}
          {isRendering
            ? "Rendering…"
            : pageCount > 0
              ? `${pageCount} page${pageCount === 1 ? "" : "s"}`
              : ""}
        </p>
        <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-background p-0.5">
          <button
            aria-label="Zoom out"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
            disabled={zoom <= minZoom}
            onClick={() => stepZoom(-1)}
            type="button"
          >
            <Minus className="size-3.5" />
          </button>
          <span className="w-11 text-center text-xs font-medium text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <button
            aria-label="Zoom in"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
            disabled={zoom >= maxZoom}
            onClick={() => stepZoom(1)}
            type="button"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      </div>
      <div
        className="scrollbar-soft h-[42rem] overflow-auto bg-muted/50 p-8"
        data-testid="preview-scroll-area"
        onWheel={handleWheelZoom}
        ref={scrollAreaRef}
      >
        <div
          className={cn("mx-auto", !html && "hidden")}
          ref={containerRef}
          style={{ width: pageWidthPx, zoom }}
        />
        {!html && (
          <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background text-center">
            <FileText className="size-7 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium text-foreground">Preview will appear here</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              {activeKind === "cv"
                ? "The role is analyzed before your tailored CV is rendered."
                : "Your cover letter is generated from the same profile and job evidence."}
            </p>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 border-t border-border px-5 py-3">
        {documents.pdf && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void onDownload(documents.pdf!.id)}
            disabled={downloadingId === documents.pdf.id}
          >
            <Download className="size-3.5" /> PDF
          </Button>
        )}
        {!hasDocument && (
          <p className="py-1 text-xs text-muted-foreground">No downloadable file yet.</p>
        )}
      </div>
    </section>
  );
}

function PackStatus({ status }: { status?: string }) {
  const isWorking = ["analyzing", "generating_documents", "queued", "scraping"].includes(
    status ?? "",
  );
  const label =
    status === "completed"
      ? "Ready"
      : status === "failed"
        ? "Needs attention"
        : status === "review_ready"
          ? "Ready to create"
          : status === "generating_documents"
            ? "Creating documents"
            : status === "analyzing"
              ? "Tailoring content"
              : "Collecting job details";

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        status === "completed" && "bg-success-soft text-success",
        status === "failed" && "bg-danger-soft text-destructive",
        status !== "completed" && status !== "failed" && "bg-info-soft text-info",
      )}
    >
      {isWorking ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
      {label}
    </span>
  );
}

function PackProgress({ status, hasDocuments }: { status?: string; hasDocuments: boolean }) {
  const steps = [
    {
      label: "Job captured",
      done: ![undefined, "queued", "scraping"].includes(status),
      active: ["queued", "scraping"].includes(status ?? ""),
    },
    {
      label: "Content tailored",
      done: ["completed", "generating_documents", "review_ready"].includes(status ?? ""),
      active: status === "analyzing",
    },
    {
      label: "Documents ready",
      done: status === "completed" && hasDocuments,
      active: status === "generating_documents",
    },
  ];

  return (
    <ol className="grid gap-3 px-5 py-4 sm:grid-cols-3">
      {steps.map((step, index) => (
        <li className="flex items-center gap-3" key={step.label}>
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
              step.done && "border-success bg-success-soft text-success",
              step.active && !step.done && "border-info bg-info-soft text-info",
              !step.done && !step.active && "border-border text-muted-foreground",
            )}
          >
            {step.done ? <Check className="size-3.5" /> : index + 1}
          </span>
          <span className="text-xs font-medium text-muted-foreground">{step.label}</span>
        </li>
      ))}
    </ol>
  );
}

interface DocumentFormats {
  docx?: GeneratedApplicationDocument;
  pdf?: GeneratedApplicationDocument;
}

function groupDocuments(
  documents: GeneratedApplicationDocument[],
): Record<"cover_letter" | "cv", DocumentFormats> {
  const grouped: Record<"cover_letter" | "cv", DocumentFormats> = {
    cv: {},
    cover_letter: {},
  };
  for (const document of documents) grouped[document.kind][document.format] = document;
  return grouped;
}

function formatReadinessWarnings(warnings: Array<"evidence" | "positioning" | "skills">): string {
  return warnings
    .map((warning) =>
      warning === "evidence"
        ? "career evidence"
        : warning === "positioning"
          ? "a headline"
          : warning,
    )
    .join(", ");
}

function packActionDescription(app: JobApplication): string {
  if (app.processingStatus === "generating_documents") return "Your application pack is updating";
  if (app.processingStatus === "completed") return "Your application pack is up to date";
  if (app.processingStatus === "review_ready") return "Your tailored content is ready";
  if (app.processingStatus === "failed") return "Review the error, then try updating the pack";
  return "Careerden is preparing your application pack";
}
