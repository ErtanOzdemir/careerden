import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../components/ui/button.js";
import { Panel, PanelHeader } from "../components/link2cv/panel.js";
import { StatusBadge } from "../components/link2cv/status-badge.js";
import type { DisplayStatus } from "../components/link2cv/status-badge.js";
import { jobApplicationsApi } from "../api/jobApplications.js";
import { profilesApi } from "../api/profiles.js";
import { mapApiJobApplicationToUi, mapApiProfileToUi } from "../api/mappers.js";
import {
  useJobApplicationChanges,
  type JobApplicationChange,
} from "../api/jobApplicationChanges.js";
import type { JobApplication, Profile } from "../types.js";
import { mapUiStatusToApi } from "../api/mappers.js";
import { cn } from "../lib/utils.js";
import AiMatchCard from "../components/AiMatchCard.js";
import { ScrapedHtmlDescription } from "../components/ScrapedHtmlDescription.js";
import type { ApiDocumentContent } from "../api/types.js";
import {
  ArrowLeft,
  MapPin,
  Briefcase,
  Sparkles,
  ExternalLink,
  Check,
  FileText,
  Download,
  Pencil,
  RefreshCw,
  CalendarClock,
  Mail,
  Loader2,
  Trash2,
} from "lucide-react";

type Tab = "overview" | "analysis" | "documents" | "timeline";

const tabs: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "analysis", label: "AI match" },
  { id: "documents", label: "Documents" },
  { id: "timeline", label: "Timeline & notes" },
];

export default function AppDetail() {
  const { id } = useParams();
  const [app, setApp] = useState<JobApplication | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isSavingFollowUp, setIsSavingFollowUp] = useState(false);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [followUpForm, setFollowUpForm] = useState({
    id: "",
    title: "",
    description: "",
    nextFollowUpAt: "",
  });
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [editingFollowUpId, setEditingFollowUpId] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState({ name: "", role: "", email: "" });
  const [showContactForm, setShowContactForm] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!id) {
      setError("Missing ID");
      setIsLoading(false);
      return;
    }
    let isMounted = true;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);
        const detail = await jobApplicationsApi.get(id!);
        const profileData = await profilesApi.get(detail.profileId);
        if (isMounted) {
          setApp(mapApiJobApplicationToUi(detail, profileData));
          setProfile(mapApiProfileToUi(profileData));
        }
      } catch (e) {
        if (isMounted) setError(e instanceof Error ? e.message : "Failed to load.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void load();
    return () => {
      isMounted = false;
    };
  }, [id]);

  useJobApplicationChanges(app?.profileId, {
    onChange: async (change: JobApplicationChange) => {
      if (!id || change.applicationId !== id) return;
      if (change.type === "application.deleted") {
        setApp(null);
        setError("Deleted.");
        return;
      }
      try {
        await refresh();
      } catch {
        /* ignore */
      }
    },
    onOpen: () => refresh(),
  });

  async function refresh() {
    if (!id) return;
    const detail = await jobApplicationsApi.get(id);
    const profileData = await profilesApi.get(detail.profileId);
    const mapped = mapApiJobApplicationToUi(detail, profileData);
    setApp(mapped);
    setProfile(mapApiProfileToUi(profileData));
    const notesValue = mapped.metadata?.notes;
    setNotes(typeof notesValue === "string" ? notesValue : "");
  }

  async function handleStatusChange(newStatus: string) {
    if (!id) return;
    try {
      setIsUpdatingStatus(true);
      setError(null);
      await jobApplicationsApi.update(id, {
        applicationStatus: mapUiStatusToApi(
          newStatus as "Applied" | "Interviewing" | "Offer" | "Rejected",
        ),
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function handleSaveFollowUp(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !followUpForm.nextFollowUpAt || !followUpForm.title.trim()) return;
    try {
      setIsSavingFollowUp(true);
      setError(null);
      const payload = {
        title: followUpForm.title.trim(),
        description: followUpForm.description.trim() || undefined,
        scheduledAt: new Date(followUpForm.nextFollowUpAt).toISOString(),
      };
      if (editingFollowUpId) {
        await jobApplicationsApi.updateFollowUp(id, editingFollowUpId, payload);
      } else {
        await jobApplicationsApi.createFollowUp(id, payload);
      }
      setFollowUpForm({ id: "", title: "", description: "", nextFollowUpAt: "" });
      setEditingFollowUpId(null);
      setShowFollowUpForm(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save follow-up.");
    } finally {
      setIsSavingFollowUp(false);
    }
  }

  function handleEditFollowUp(followUpId: string) {
    if (!app?.followUps) return;
    const followUp = app.followUps.find((f) => f.id === followUpId);
    if (!followUp) return;
    setFollowUpForm({
      id: followUp.id,
      title: followUp.title,
      description: followUp.description ?? "",
      nextFollowUpAt: toDateTimeLocalValue(followUp.scheduledAt),
    });
    setEditingFollowUpId(followUp.id);
    setShowFollowUpForm(true);
  }

  async function handleDeleteFollowUp(followUpId: string) {
    if (!id) return;
    try {
      setIsSavingFollowUp(true);
      setError(null);
      await jobApplicationsApi.deleteFollowUp(id, followUpId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete follow-up.");
    } finally {
      setIsSavingFollowUp(false);
    }
  }

  function handleToggleFollowUpForm() {
    setFollowUpForm({ id: "", title: "", description: "", nextFollowUpAt: "" });
    setEditingFollowUpId(null);
    setShowFollowUpForm((v) => !v);
  }

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !contactForm.name.trim()) return;
    try {
      setIsAddingContact(true);
      setError(null);
      await jobApplicationsApi.createContact(id, {
        name: contactForm.name.trim(),
        role: contactForm.role.trim() || undefined,
        email: contactForm.email.trim() || undefined,
      });
      setContactForm({ name: "", role: "", email: "" });
      setShowContactForm(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add contact.");
    } finally {
      setIsAddingContact(false);
    }
  }

  async function handleSaveNotes() {
    if (!id || !app) return;
    try {
      setIsSavingNotes(true);
      setError(null);
      await jobApplicationsApi.update(id, {
        metadata: { ...(app.metadata ?? {}), notes: notes.trim() },
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save notes.");
    } finally {
      setIsSavingNotes(false);
    }
  }

  async function handleGenerateDocuments() {
    if (!id) return;
    try {
      setIsGenerating(true);
      setError(null);
      await jobApplicationsApi.generateDocuments(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSaveDocumentContent(content: ApiDocumentContent) {
    if (!id) return;
    try {
      setIsSavingContent(true);
      setError(null);
      await jobApplicationsApi.updateDocumentContent(id, content);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setIsSavingContent(false);
    }
  }

  async function handleRetry() {
    if (!id) return;
    try {
      setIsRetrying(true);
      setError(null);
      if (app?.processingStatus === "scraped") {
        await jobApplicationsApi.startAnalysis(id);
      } else {
        await jobApplicationsApi.retry(id);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setIsRetrying(false);
    }
  }

  async function handleDownload(docId: string) {
    if (!id) return;
    try {
      setDownloadingId(docId);
      const doc = app?.generatedDocuments?.find((d) => d.id === docId);
      if (!doc) throw new Error("Not found");
      const { url } = await jobApplicationsApi.getDocumentDownloadUrl(id, { id: doc.id });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setDownloadingId(null);
    }
  }

  if (isLoading) return <div className="py-16 text-center text-muted-foreground">Loading...</div>;
  if (!app)
    return (
      <div className="py-16 text-center">
        <p className="text-sm font-medium text-foreground">Application not found</p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <Link to="/applications" className="mt-4 inline-block text-sm text-primary hover:underline">
          Back to applications
        </Link>
      </div>
    );

  const isProcessing = ["queued", "scraping", "analyzing", "generating_documents"].includes(
    app.processingStatus ?? "",
  );
  const processingLabel = getProcessingLabel(app);

  return (
    <div className="space-y-6">
      <Link
        to="/applications"
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to applications
      </Link>

      <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-secondary text-base font-semibold text-secondary-foreground">
            {app.logo ? (
              <img src={app.logo} alt="" className="size-full object-contain" />
            ) : (
              app.company.slice(0, 2)
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-semibold text-foreground">{app.role}</h2>
              <StatusBadge status={mapStatus(app)} />
              <select
                value={app.status}
                onChange={(e) => void handleStatusChange(e.target.value)}
                disabled={isUpdatingStatus}
                className="rounded-lg border border-input bg-card px-2 py-0.5 text-xs font-medium text-foreground outline-none focus:border-ring"
              >
                {["Applied", "Interviewing", "Offer", "Rejected"].map((s) => (
                  <option key={s} value={s}>
                    {s === app.status ? `${s} (current)` : `→ ${s}`}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{app.company}</p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                {app.location}
              </span>
              {app.tags?.[0] && (
                <span className="flex items-center gap-1.5">
                  <Briefcase className="size-3.5" />
                  {app.tags[0]}
                </span>
              )}
              {app.matchScore && (
                <span
                  className={cn(
                    "flex items-center gap-1.5",
                    (app.matchScore ?? 0) >= 70
                      ? "text-success"
                      : (app.matchScore ?? 0) >= 50
                        ? "text-warning-foreground"
                        : "text-destructive",
                  )}
                >
                  <Sparkles className="size-3.5" />
                  {app.matchScore}% match
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (app.sourceUrl) window.open(app.sourceUrl, "_blank", "noopener,noreferrer");
            }}
            disabled={!app.sourceUrl}
          >
            <ExternalLink className="size-3.5" />
            View on LinkedIn
          </Button>
          {app.aiMatch ? (
            <Button size="sm" onClick={handleGenerateDocuments} disabled={isGenerating}>
              <Sparkles className="size-3.5" />
              {app.generatedDocuments?.length ? "Regenerate" : "Generate documents"}
            </Button>
          ) : (
            <Button size="sm" onClick={handleRetry} disabled={isRetrying}>
              <RefreshCw className={`size-3.5 ${isRetrying ? "animate-spin" : ""}`} />
              Start analysis
            </Button>
          )}
        </div>
      </div>

      {isProcessing && app.processingStatus !== "failed" && (
        <div className="rounded-xl border border-info/20 bg-info-soft/60 p-4">
          <div className="flex items-center gap-2.5">
            <Loader2 className="size-4 animate-spin text-info" />
            <p className="text-sm font-medium text-foreground">{processingLabel}</p>
            <span className="ml-auto text-xs text-muted-foreground">Runs in the background</span>
          </div>
          <div className="mt-3 flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full",
                  stepDone(app, i) ? "bg-info" : "bg-info/20",
                )}
              />
            ))}
          </div>
        </div>
      )}

      {app.processingStatus === "failed" && (
        <div className="rounded-xl border border-destructive/20 bg-danger-soft p-4 flex items-center justify-between">
          <p className="text-sm text-destructive">
            {app.processingFailureReason ?? "Processing failed"}
          </p>
          <Button variant="outline" size="sm" onClick={handleRetry} disabled={isRetrying}>
            <RefreshCw className="size-3.5" />
            Retry
          </Button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-danger-soft p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "-mb-px border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
              tab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab app={app} />}
      {tab === "analysis" &&
        (app.aiMatch && app.documentContent ? (
          <AiMatchCard
            aiMatch={app.aiMatch}
            canCreateCv={["review_ready", "completed"].includes(app.processingStatus ?? "")}
            hasGeneratedDocuments={(app.generatedDocuments?.length ?? 0) > 0}
            isCreatingCv={isGenerating}
            isSavingContent={isSavingContent}
            documentContent={app.documentContent}
            profile={profile ?? undefined}
            onSaveContent={handleSaveDocumentContent}
            onCreateCv={handleGenerateDocuments}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
            <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Sparkles className="size-5" />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">Match analysis in progress</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Once we finish extracting the job details, the AI wizard will appear here.
            </p>
          </div>
        ))}
      {tab === "documents" && (
        <DocumentsTab
          app={app}
          isGenerating={isGenerating}
          downloadingId={downloadingId}
          onGenerate={handleGenerateDocuments}
          onDownload={handleDownload}
        />
      )}
      {tab === "timeline" && (
        <TimelineTab
          app={app}
          followUpForm={followUpForm}
          showFollowUpForm={showFollowUpForm}
          isSavingFollowUp={isSavingFollowUp}
          isSavingNotes={isSavingNotes}
          contactForm={contactForm}
          showContactForm={showContactForm}
          isAddingContact={isAddingContact}
          notes={notes}
          onSetFollowUpForm={setFollowUpForm}
          onToggleFollowUpForm={handleToggleFollowUpForm}
          onSaveFollowUp={handleSaveFollowUp}
          onEditFollowUp={handleEditFollowUp}
          onDeleteFollowUp={handleDeleteFollowUp}
          onSetContactForm={setContactForm}
          onToggleContactForm={() => setShowContactForm((v) => !v)}
          onAddContact={handleAddContact}
          onNotesChange={setNotes}
          onSaveNotes={handleSaveNotes}
        />
      )}
    </div>
  );
}

// --- Sub-components ---

function OverviewTab({ app }: { app: JobApplication }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Panel className="lg:col-span-2">
        <PanelHeader title="Role summary" />
        <div className="border-t border-border px-5 py-4">
          {app.description ? (
            <div>
              {app.descriptionHtml ? (
                <ScrapedHtmlDescription html={app.descriptionHtml} />
              ) : (
                <p className="text-sm leading-relaxed text-muted-foreground">{app.description}</p>
              )}
              {app.requirements && app.requirements.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {app.requirements.map((r, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-muted-foreground">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-border" />
                      {r}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Job details are still being extracted.</p>
          )}
        </div>
      </Panel>
      <Panel className="self-start">
        <PanelHeader title="At a glance" />
        <dl className="divide-y divide-border border-t border-border text-sm">
          {[
            ["Source", app.domain],
            ["Added", app.dateApplied],
            ["Status", app.status],
            ["Match", app.matchScore ? `${app.matchScore}%` : "Pending"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between px-5 py-2.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </div>
  );
}

function DocumentsTab({
  app,
  isGenerating,
  downloadingId,
  onGenerate,
  onDownload,
}: {
  app: JobApplication;
  isGenerating: boolean;
  downloadingId: string | null;
  onGenerate: () => void;
  onDownload: (id: string) => void;
}) {
  const docs = app.generatedDocuments ?? [];
  const cvDoc = docs.find((d) => d.kind === "cv");
  const coverDoc = docs.find((d) => d.kind === "cover_letter");
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <DocCard
        title="Tailored CV"
        desc="Profile-aware resume optimized for this role"
        ready={!!cvDoc}
        doc={cvDoc}
        isGenerating={isGenerating}
        downloadingId={downloadingId}
        onGenerate={onGenerate}
        onDownload={onDownload}
      />
      <DocCard
        title="Cover letter"
        desc="Personalized letter referencing the job requirements"
        ready={!!coverDoc}
        doc={coverDoc}
        isGenerating={isGenerating}
        downloadingId={downloadingId}
        onGenerate={onGenerate}
        onDownload={onDownload}
      />
    </div>
  );
}

function DocCard({
  title,
  desc,
  ready,
  doc,
  isGenerating,
  downloadingId,
  onGenerate,
  onDownload,
}: {
  title: string;
  desc: string;
  ready: boolean;
  doc?: { id: string; name: string; createdAt: string };
  isGenerating: boolean;
  downloadingId: string | null;
  onGenerate: () => void;
  onDownload: (id: string) => void;
}) {
  return (
    <Panel className="p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <FileText className="size-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      {ready && doc ? (
        <>
          <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
            Generated and ready. {doc.name}
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm">
              <Pencil className="size-3.5" />
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={onGenerate} disabled={isGenerating}>
              <RefreshCw className="size-3.5" />
              Regenerate
            </Button>
            <Button
              size="sm"
              className="ml-auto"
              onClick={() => onDownload(doc.id)}
              disabled={downloadingId === doc.id}
            >
              <Download className="size-3.5" />
              {downloadingId === doc.id ? "..." : "Download"}
            </Button>
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-border p-5 text-center">
          <p className="text-sm text-muted-foreground">Not generated yet</p>
          <Button size="sm" className="mt-3" onClick={onGenerate} disabled={isGenerating}>
            <Sparkles className="size-3.5" />
            Generate {title.toLowerCase()}
          </Button>
        </div>
      )}
    </Panel>
  );
}
function TimelineTab({
  app,
  followUpForm,
  showFollowUpForm,
  isSavingFollowUp,
  isSavingNotes,
  contactForm,
  showContactForm,
  isAddingContact,
  notes,
  onSetFollowUpForm,
  onToggleFollowUpForm,
  onSaveFollowUp,
  onEditFollowUp,
  onDeleteFollowUp,
  onSetContactForm,
  onToggleContactForm,
  onAddContact,
  onNotesChange,
  onSaveNotes,
}: {
  app: JobApplication;
  followUpForm: { id: string; title: string; description: string; nextFollowUpAt: string };
  showFollowUpForm: boolean;
  isSavingFollowUp: boolean;
  isSavingNotes: boolean;
  contactForm: { name: string; role: string; email: string };
  showContactForm: boolean;
  isAddingContact: boolean;
  notes: string;
  onSetFollowUpForm: (f: {
    id: string;
    title: string;
    description: string;
    nextFollowUpAt: string;
  }) => void;
  onToggleFollowUpForm: () => void;
  onSaveFollowUp: (e: React.FormEvent) => void;
  onEditFollowUp: (followUpId: string) => void;
  onDeleteFollowUp: (followUpId: string) => void;
  onSetContactForm: (f: { name: string; role: string; email: string }) => void;
  onToggleContactForm: () => void;
  onAddContact: (e: React.FormEvent) => void;
  onNotesChange: (v: string) => void;
  onSaveNotes: () => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Panel className="lg:col-span-2">
        <PanelHeader
          title="Follow-ups"
          action={
            <Button variant="ghost" size="sm" onClick={onToggleFollowUpForm}>
              + Add follow-up
            </Button>
          }
        />
        {showFollowUpForm && (
          <form onSubmit={onSaveFollowUp} className="space-y-3 border-t border-border px-5 py-4">
            <div>
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor="follow-up-title"
              >
                Title
              </label>
              <input
                id="follow-up-title"
                type="text"
                value={followUpForm.title}
                onChange={(e) => onSetFollowUpForm({ ...followUpForm, title: e.target.value })}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                placeholder="e.g. Send thank-you email"
                required
              />
            </div>
            <div>
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor="follow-up-description"
              >
                Description (optional)
              </label>
              <textarea
                id="follow-up-description"
                value={followUpForm.description}
                onChange={(e) =>
                  onSetFollowUpForm({ ...followUpForm, description: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                placeholder="Add context for this follow-up..."
                rows={2}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground" htmlFor="follow-up-at">
                Follow-up date and time
              </label>
              <input
                id="follow-up-at"
                type="datetime-local"
                value={followUpForm.nextFollowUpAt}
                onChange={(e) =>
                  onSetFollowUpForm({ ...followUpForm, nextFollowUpAt: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Link2CV will notify you automatically 10 minutes before this time.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" type="button" onClick={onToggleFollowUpForm}>
                Cancel
              </Button>
              <Button size="sm" type="submit" disabled={isSavingFollowUp}>
                {isSavingFollowUp ? "Saving..." : "Save follow-up"}
              </Button>
            </div>
          </form>
        )}
        {app.followUps && app.followUps.length > 0 && (
          <div className="divide-y divide-border border-t border-border">
            {app.followUps.map((f) => (
              <div key={f.id} className="flex items-start gap-3 px-5 py-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <CalendarClock className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{f.title}</p>
                  {f.description && (
                    <p className="text-xs text-muted-foreground">{f.description}</p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(f.scheduledAt).toLocaleString()}
                    {f.reminderSentAt && (
                      <span className="ml-2 inline-flex items-center gap-1 text-success">
                        <Check className="size-3" /> Reminder sent
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditFollowUp(f.id)}
                    disabled={isSavingFollowUp}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void onDeleteFollowUp(f.id)}
                    disabled={isSavingFollowUp}
                    aria-label={`Delete ${f.title}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="space-y-6">
        <Panel>
          <PanelHeader
            title="Notes"
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void onSaveNotes()}
                disabled={isSavingNotes}
              >
                {isSavingNotes ? "Saving..." : "Save"}
              </Button>
            }
          />
          <div className="border-t border-border px-5 py-4">
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Add context, reminders, or recruiter details..."
              rows={5}
              className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:border-ring"
            />
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Contacts"
            action={
              <Button variant="ghost" size="sm" onClick={onToggleContactForm}>
                + Add
              </Button>
            }
          />
          {showContactForm && (
            <form onSubmit={onAddContact} className="border-t border-border px-5 py-4 space-y-3">
              <input
                placeholder="Name"
                value={contactForm.name}
                onChange={(e) => onSetContactForm({ ...contactForm, name: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                required
              />
              <input
                placeholder="Role"
                value={contactForm.role}
                onChange={(e) => onSetContactForm({ ...contactForm, role: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              />
              <input
                placeholder="Email"
                type="email"
                value={contactForm.email}
                onChange={(e) => onSetContactForm({ ...contactForm, email: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" type="button" onClick={onToggleContactForm}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" disabled={isAddingContact}>
                  {isAddingContact ? "Saving..." : "Add"}
                </Button>
              </div>
            </form>
          )}
          <div className="divide-y divide-border border-t border-border">
            {app.contacts && app.contacts.length > 0 ? (
              app.contacts.map((c, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                    {c.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.role}</p>
                  </div>
                  {c.email && (
                    <a
                      href={`mailto:${c.email}`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Mail className="size-3.5" />
                    </a>
                  )}
                </div>
              ))
            ) : (
              <p className="px-5 py-4 text-sm text-muted-foreground">No contacts added yet.</p>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
// --- helpers ---

function mapStatus(app: JobApplication): DisplayStatus {
  const ps = app.processingStatus;
  if (ps && ["queued", "scraping", "analyzing", "generating_documents"].includes(ps))
    return "processing";
  if (ps === "review_ready") return "ready";
  switch (app.status) {
    case "Applied":
      return "applied";
    case "Interviewing":
      return "interview";
    case "Offer":
      return "offer";
    case "Rejected":
      return "rejected";
    default:
      return "saved";
  }
}

function toDateTimeLocalValue(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function getProcessingLabel(app: JobApplication): string {
  switch (app.processingStatus) {
    case "queued":
      return app.processingFailureReason ? "Retry scheduled" : "Scraping waiting";
    case "scraping":
      return "Extracting LinkedIn details";
    case "analyzing":
      return "Running AI analysis";
    case "generating_documents":
      return "Generating documents";
    default:
      return app.processingStatusLabel ?? "Processing";
  }
}

function stepDone(app: JobApplication, step: number): boolean {
  const stages = ["scraping", "analyzing", "generating_documents"];
  return step <= stages.indexOf(app.processingStatus ?? "");
}
