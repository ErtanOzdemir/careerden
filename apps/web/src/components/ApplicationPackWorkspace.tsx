import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type {
  ApiApplicationPackPreferences,
  ApiDocumentContent,
  ApiProfile,
  ApiDocumentTemplate,
} from "../api/types.js";
import type { GeneratedApplicationDocument, JobApplication } from "../types.js";
import { cn } from "../lib/utils.js";
import { mergeRichDocumentsAsProse, richDocumentFromText } from "../lib/rich-document.js";
import { ApplicationPackCustomizer } from "./ApplicationPackCustomizer.js";
import { RichTextViewer } from "./RichTextEditor.js";
import { Button, buttonVariants } from "./ui/button.js";
import {
  AlertTriangle,
  Check,
  Download,
  Eye,
  FileText,
  Loader2,
  Sparkles,
  UserRound,
} from "lucide-react";

interface ApplicationPackWorkspaceProps {
  app: JobApplication;
  profile?: ApiProfile;
  templates: ApiDocumentTemplate[];
  isUpdating: boolean;
  downloadingId: string | null;
  onDownload: (documentId: string) => Promise<void>;
  onResolveDocumentUrl: (documentId: string) => Promise<string>;
  onUpdate: (
    documentContent: ApiDocumentContent,
    preferences: ApiApplicationPackPreferences,
  ) => Promise<void>;
}

const defaultPreferences: ApiApplicationPackPreferences = {
  language: "auto",
  tone: "professional",
};

type PreviewMode = "live" | "rendered";

export function ApplicationPackWorkspace({
  app,
  profile,
  templates,
  isUpdating,
  downloadingId,
  onDownload,
  onResolveDocumentUrl,
  onUpdate,
}: ApplicationPackWorkspaceProps) {
  const [draftContent, setDraftContent] = useState(app.documentContent);
  const [preferences, setPreferences] = useState(
    app.applicationPackPreferences ?? defaultPreferences,
  );
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [previewModes, setPreviewModes] = useState<Record<"cover_letter" | "cv", PreviewMode>>({
    cover_letter: "rendered",
    cv: "rendered",
  });
  const [isDownloadingBoth, setIsDownloadingBoth] = useState(false);

  const documents = useMemo(() => groupDocuments(app.generatedDocuments ?? []), [app]);
  const previewDocumentIds = [documents.cv.pdf?.id, documents.cover_letter.pdf?.id]
    .filter((id): id is string => Boolean(id))
    .join(":");

  useEffect(() => {
    setDraftContent(app.documentContent);
    setPreferences(app.applicationPackPreferences ?? defaultPreferences);
  }, [app.applicationPackPreferences, app.documentContent, app.id]);

  useEffect(() => {
    setPreviewModes({
      cover_letter: documents.cover_letter.pdf ? "rendered" : "live",
      cv: documents.cv.pdf ? "rendered" : "live",
    });
  }, [previewDocumentIds]);

  useEffect(() => {
    let cancelled = false;
    const pdfDocuments = [documents.cv.pdf, documents.cover_letter.pdf].filter(
      (document): document is GeneratedApplicationDocument => Boolean(document),
    );
    setPreviewUrls({});
    void Promise.all(
      pdfDocuments.map(async (document) => ({
        id: document.id,
        url: await onResolveDocumentUrl(document.id),
      })),
    )
      .then((resolved) => {
        if (!cancelled)
          setPreviewUrls(Object.fromEntries(resolved.map(({ id, url }) => [id, url])));
      })
      .catch(() => {
        // A download action remains available when an inline preview cannot be resolved.
      });

    return () => {
      cancelled = true;
    };
  }, [previewDocumentIds, onResolveDocumentUrl]);

  const readiness = app.profileReadiness;
  const canUpdate =
    Boolean(app.aiMatch && draftContent) &&
    readiness?.state !== "blocked" &&
    ["completed", "failed", "review_ready"].includes(app.processingStatus ?? "");
  const isDirty =
    JSON.stringify(draftContent) !== JSON.stringify(app.documentContent) ||
    JSON.stringify(preferences) !==
      JSON.stringify(app.applicationPackPreferences ?? defaultPreferences);
  const pdfDocuments = [documents.cv.pdf, documents.cover_letter.pdf].filter(
    (document): document is GeneratedApplicationDocument => Boolean(document),
  );
  const hasDocxWithoutPdf = Boolean(
    (documents.cv.docx && !documents.cv.pdf) ||
    (documents.cover_letter.docx && !documents.cover_letter.pdf),
  );

  async function handleUpdate() {
    if (!draftContent || !canUpdate) return;
    await onUpdate(draftContent, preferences);
  }

  function handleContentChange(content: ApiDocumentContent) {
    setDraftContent(content);
    setPreviewModes({ cover_letter: "live", cv: "live" });
  }

  function handlePreferencesChange(nextPreferences: ApiApplicationPackPreferences) {
    setPreferences(nextPreferences);
    setPreviewModes({ cover_letter: "live", cv: "live" });
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

      {hasDocxWithoutPdf && ["completed", "failed"].includes(app.processingStatus ?? "") && (
        <section className="flex flex-col gap-3 rounded-xl border border-info/20 bg-info-soft/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Eye className="mt-0.5 size-4 shrink-0 text-info" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {app.processingStatus === "failed"
                  ? "PDF preview rendering failed"
                  : "PDF preview not rendered yet"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                The complete CV content is shown below. Render previews to see the exact template
                layout.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!canUpdate || isUpdating}
            onClick={() => void handleUpdate()}
          >
            {isUpdating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <FileText className="size-3.5" />
            )}
            {app.processingStatus === "failed" ? "Retry PDF previews" : "Render PDF previews"}
          </Button>
        </section>
      )}

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

      <div className="grid gap-5 xl:grid-cols-2">
        <DocumentPreviewCard
          description="Role-specific experience, summary, and skills"
          documents={documents.cv}
          downloadingId={downloadingId}
          isStale={isDirty}
          livePreview={
            draftContent ? <CvContentPreview content={draftContent} profile={profile} /> : undefined
          }
          livePreviewLabel="Live CV content"
          kind="cv"
          onDownload={onDownload}
          onPreviewModeChange={(mode) => setPreviewModes((current) => ({ ...current, cv: mode }))}
          previewMode={previewModes.cv}
          previewUrl={documents.cv.pdf ? previewUrls[documents.cv.pdf.id] : undefined}
          title="Tailored CV"
        />
        <DocumentPreviewCard
          description="A concise introduction grounded in your profile"
          documents={documents.cover_letter}
          downloadingId={downloadingId}
          isStale={isDirty}
          livePreview={
            draftContent?.coverLetterContent ? (
              <RichTextViewer
                ariaLabel="Cover letter content preview"
                value={draftContent.coverLetterContent}
              />
            ) : undefined
          }
          livePreviewLabel="Live cover letter"
          kind="cover_letter"
          onDownload={onDownload}
          onPreviewModeChange={(mode) =>
            setPreviewModes((current) => ({ ...current, cover_letter: mode }))
          }
          previewMode={previewModes.cover_letter}
          previewUrl={
            documents.cover_letter.pdf ? previewUrls[documents.cover_letter.pdf.id] : undefined
          }
          title="Cover letter"
        />
      </div>

      {app.aiMatch && draftContent && (
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
          <p className="text-sm font-medium text-foreground">
            {isDirty ? "You have unapplied changes" : packActionDescription(app)}
          </p>
          <p className="text-xs text-muted-foreground">
            Updates run in the background; you can leave this page safely.
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
          <Button onClick={() => void handleUpdate()} disabled={!canUpdate || isUpdating}>
            {isUpdating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {app.generatedDocuments?.length ? "Update pack" : "Create pack"}
          </Button>
        </div>
      </section>
    </div>
  );
}

function MatchSnapshot({ app }: { app: JobApplication }) {
  const match = app.aiMatch!;
  const requirements = match.requirements ?? [];

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="grid gap-5 lg:grid-cols-[12rem,1fr]">
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

function DocumentPreviewCard({
  title,
  description,
  kind,
  documents,
  previewUrl,
  livePreview,
  livePreviewLabel,
  previewMode,
  isStale,
  downloadingId,
  onDownload,
  onPreviewModeChange,
}: {
  title: string;
  description: string;
  kind: "cover_letter" | "cv";
  documents: DocumentFormats;
  previewUrl?: string;
  livePreview?: ReactNode;
  livePreviewLabel: string;
  previewMode: PreviewMode;
  isStale: boolean;
  downloadingId: string | null;
  onDownload: (documentId: string) => Promise<void>;
  onPreviewModeChange: (mode: PreviewMode) => void;
}) {
  const hasDocument = Boolean(documents.pdf || documents.docx);
  const canShowRendered = Boolean(previewUrl);
  const canShowLive = Boolean(livePreview);
  const visibleMode = previewMode === "rendered" && canShowRendered ? "rendered" : "live";

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <FileText className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-1 text-[0.7rem] font-medium",
            isStale && hasDocument
              ? "bg-warning-soft text-warning-emphasis"
              : hasDocument
                ? "bg-success-soft text-success"
                : "bg-muted text-muted-foreground",
          )}
        >
          {isStale && hasDocument ? "Out of date" : hasDocument ? "Ready" : "Pending"}
        </span>
      </div>
      <div className="bg-muted/30 p-3">
        {canShowLive && canShowRendered && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-lg border border-border bg-background p-0.5">
              {[
                { label: "Live content", value: "live" as const },
                { label: "Rendered PDF", value: "rendered" as const },
              ].map((option) => (
                <button
                  aria-pressed={visibleMode === option.value}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium",
                    visibleMode === option.value
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  key={option.value}
                  onClick={() => onPreviewModeChange(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
            {isStale && (
              <p className="text-xs font-medium text-warning-emphasis">
                The PDF does not include your unapplied changes.
              </p>
            )}
          </div>
        )}
        <div className={canShowLive && canShowRendered ? "h-[25rem]" : "h-[28rem]"}>
          {visibleMode === "rendered" && previewUrl ? (
            <iframe
              className="size-full rounded-lg border border-border bg-white"
              src={previewUrl}
              title={`${title} preview`}
            />
          ) : livePreview ? (
            <div className="scrollbar-soft h-full overflow-y-auto rounded-lg border border-border bg-background p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Eye className="size-3.5" /> {livePreviewLabel}
              </div>
              {livePreview}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background text-center">
              <FileText className="size-7 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium text-foreground">Preview will appear here</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                {kind === "cv"
                  ? "The role is analyzed before your tailored CV is rendered."
                  : "Your cover letter is generated from the same profile and job evidence."}
              </p>
            </div>
          )}
        </div>
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
        {documents.docx && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void onDownload(documents.docx!.id)}
            disabled={downloadingId === documents.docx.id}
          >
            <Download className="size-3.5" /> DOCX
          </Button>
        )}
        {!hasDocument && (
          <p className="py-1 text-xs text-muted-foreground">No downloadable file yet.</p>
        )}
      </div>
    </section>
  );
}

function CvContentPreview({
  content,
  profile,
}: {
  content: ApiDocumentContent;
  profile?: ApiProfile;
}) {
  if (!profile) {
    return <RichTextViewer ariaLabel="CV content preview" value={content.customizedSummary} />;
  }

  const summary =
    content.selections.customizedSummary === "original"
      ? (profile.summaryRichText ??
        (profile.summary ? richDocumentFromText(profile.summary) : content.customizedSummary))
      : content.customizedSummary;
  const skills =
    content.selections.skills === "original" || content.skillSuggestions.length === 0
      ? profile.skills
      : content.skillSuggestions;
  const certifications =
    content.selections.certifications === "original" ||
    content.certificationSuggestions.length === 0
      ? profile.certifications
      : content.certificationSuggestions;

  return (
    <article
      aria-label="Full CV content preview"
      className="mx-auto min-h-full max-w-2xl bg-white px-7 py-8 text-slate-900 shadow-sm sm:px-10 [&_.rich-editor-content]:text-slate-700"
    >
      <header className="border-b border-slate-200 pb-5 text-center">
        <h4 className="text-xl font-semibold tracking-tight text-slate-950">{profile.fullName}</h4>
        {(profile.headline || profile.profession) && (
          <p className="mt-1 text-sm font-medium text-slate-600">
            {profile.headline ?? profile.profession}
          </p>
        )}
        <p className="mt-2 text-xs text-slate-500">
          {[profile.email, profile.location, ...profile.links].filter(Boolean).join(" · ")}
        </p>
      </header>

      <CvSection title="Profile">
        <RichTextViewer ariaLabel="CV profile summary" value={summary} />
      </CvSection>

      {profile.experience.length > 0 && (
        <CvSection title="Experience">
          <div className="space-y-4">
            {profile.experience.map((experience, index) => {
              const enhancement = content.experienceEnhancements.find(
                (item) => item.experienceIndex === index,
              );
              const selection = content.selections.experience[String(index)];
              const originalDescription =
                experience.descriptionRichText ??
                (experience.description ? richDocumentFromText(experience.description) : undefined);
              const description =
                selection?.description === "original"
                  ? originalDescription
                  : (enhancement?.description ?? originalDescription);

              return (
                <div key={`${experience.company}-${experience.title}-${index}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {experience.title} · {experience.company}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatPeriod(experience.startDate, experience.endDate)}
                    </p>
                  </div>
                  {description && (
                    <div className="mt-1.5">
                      <RichTextViewer
                        ariaLabel={`${experience.title} experience description`}
                        value={description}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CvSection>
      )}

      {skills.length > 0 && (
        <CvSection title="Skills">
          <p className="text-sm leading-6 text-slate-700">{skills.join(" · ")}</p>
        </CvSection>
      )}

      {profile.projects.length > 0 && (
        <CvSection title="Projects">
          <div className="space-y-4">
            {profile.projects.map((project, index) => {
              const enhancement = content.projectEnhancements.find(
                (item) => item.projectIndex === index,
              );
              const selection = content.selections.projects[String(index)];
              const originalDescription = mergeRichDocumentsAsProse(
                project.descriptionRichText ??
                  (project.description ? richDocumentFromText(project.description) : undefined),
                ...project.achievements.map(richDocumentFromText),
              );
              const description =
                selection?.description === "original"
                  ? originalDescription
                  : (enhancement?.description ?? originalDescription);

              return (
                <div key={`${project.name}-${index}`}>
                  <p className="text-sm font-semibold text-slate-900">{project.name}</p>
                  {description && (
                    <div className="mt-1.5">
                      <RichTextViewer
                        ariaLabel={`${project.name} project description`}
                        value={description}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CvSection>
      )}

      {profile.education.length > 0 && (
        <CvSection title="Education">
          <div className="space-y-4">
            {profile.education.map((education, index) => {
              const enhancement = content.educationEnhancements.find(
                (item) => item.educationIndex === index,
              );
              const selection = content.selections.education[String(index)];
              const description =
                selection?.description === "original" ? undefined : enhancement?.description;

              return (
                <div key={`${education.institution}-${index}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold text-slate-900">{education.institution}</span>
                      {[education.degree, education.field].filter(Boolean).length > 0 &&
                        ` · ${[education.degree, education.field].filter(Boolean).join(", ")}`}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatPeriod(education.startDate, education.endDate)}
                    </p>
                  </div>
                  {description && (
                    <div className="mt-1.5">
                      <RichTextViewer
                        ariaLabel={`${education.institution} education description`}
                        value={description}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CvSection>
      )}

      {certifications.length > 0 && (
        <CvSection title="Certifications">
          <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
            {certifications.map((certification) => (
              <li key={certification}>{certification}</li>
            ))}
          </ul>
        </CvSection>
      )}
    </article>
  );
}

function CvSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="mt-5">
      <h5 className="mb-2 border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {title}
      </h5>
      {children}
    </section>
  );
}

function formatPeriod(startDate?: string, endDate?: string): string {
  if (!startDate && !endDate) return "";
  return `${startDate || "Start not set"} – ${endDate || "Present"}`;
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
  return "Link2CV is preparing your application pack";
}
