import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button, buttonVariants } from "../components/ui/button.js";
import { ConfirmDialog } from "../components/ui/confirm-dialog.js";
import { UndoToast } from "../components/careerden/undo-toast.js";
import { Panel, PanelHeader } from "../components/careerden/panel.js";
import { StatusBadge } from "../components/careerden/status-badge.js";
import type { DisplayStatus } from "../components/careerden/status-badge.js";
import { jobApplicationsApi } from "../api/jobApplications.js";
import { hasApiErrorCode } from "../api/client.js";
import { profilesApi } from "../api/profiles.js";
import { useCreditBalance } from "../billing/CreditBalanceProvider.js";
import { mapApiJobApplicationToUi } from "../api/mappers.js";
import {
  useJobApplicationChanges,
  type JobApplicationChange,
} from "../api/jobApplicationChanges.js";
import type { ApplicationStatus, InterestLevel, JobApplication } from "../types.js";
import { formatApplicationStatus, mapUiStatusToApi } from "../api/mappers.js";
import { cn } from "../lib/utils.js";
import { ApplicationPackWorkspace } from "../components/ApplicationPackWorkspace.js";
import { ScrapedHtmlDescription } from "../components/ScrapedHtmlDescription.js";
import { LinkedInImportFallback } from "../components/LinkedInImportFallback.js";
import { getLinkedInImportFailure, openManualPasteFlow } from "../lib/linkedin-import-fallback.js";
import { aiProviderPath } from "../settings/AiProviderSettings.js";
import { UnifiedSelect, type UnifiedSelectOption } from "../components/careerden/unified-select.js";
import type {
  ApiApplicationPackPreferences,
  ApiDocumentContent,
  ApiProfile,
} from "../api/types.js";
import { HTML_TEMPLATES } from "@careerden/contracts";
import {
  ArrowLeft,
  MapPin,
  Briefcase,
  Sparkles,
  ExternalLink,
  Check,
  Pencil,
  RefreshCw,
  CalendarClock,
  CalendarPlus2,
  Mail,
  Loader2,
  Trash2,
  Archive,
  ArchiveRestore,
  EllipsisVertical,
} from "lucide-react";

type Tab = "overview" | "pack" | "timeline";

const tabs: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "pack", label: "Application pack" },
  { id: "timeline", label: "Follow-ups & notes" },
];

export default function AppDetail() {
  const { refreshBalance } = useCreditBalance();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [app, setApp] = useState<JobApplication | null>(null);
  const [profile, setProfile] = useState<ApiProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisCreditError, setAnalysisCreditError] = useState(false);
  const [aiProviderMissing, setAiProviderMissing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<Tab>(() => parseTab(searchParams.get("tab")) ?? "pack");
  const [isUpdatingPack, setIsUpdatingPack] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  // The latest status change, while it can still be undone from its toast.
  const [statusUndo, setStatusUndo] = useState<{ eventId: string; label: string } | null>(null);
  const dismissStatusUndo = useCallback(() => setStatusUndo(null), []);
  const [isSavingFollowUp, setIsSavingFollowUp] = useState(false);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isSavingSalary, setIsSavingSalary] = useState(false);
  const [isSavingInterest, setIsSavingInterest] = useState(false);
  const [isSavingWorkStyle, setIsSavingWorkStyle] = useState(false);
  const [isChangingArchiveState, setIsChangingArchiveState] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);
  const [followUpForm, setFollowUpForm] = useState({
    id: "",
    title: "",
    description: "",
    nextFollowUpAt: "",
  });

  useEffect(() => {
    if (!actionsMenuOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
        setActionsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [actionsMenuOpen]);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [editingFollowUpId, setEditingFollowUpId] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState({ name: "", role: "", email: "", phone: "" });
  const [showContactForm, setShowContactForm] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const requestedTab = parseTab(searchParams.get("tab"));
    if (requestedTab) {
      setTab(requestedTab);
    }
  }, [searchParams]);

  // Every draft below belongs to one application, and the route keeps this page mounted when the
  // id changes. Without the reset an open follow-up or contact form, a pending status undo, or a
  // failed analysis notice follows the user to the next application and reads as data it owns.
  useEffect(() => {
    setFollowUpForm({ id: "", title: "", description: "", nextFollowUpAt: "" });
    setEditingFollowUpId(null);
    setShowFollowUpForm(false);
    setContactForm({ name: "", role: "", email: "", phone: "" });
    setShowContactForm(false);
    setStatusUndo(null);
    setActionsMenuOpen(false);
    setDeleteDialogOpen(false);
    setDeleteError(null);
    setAnalysisCreditError(false);
    setAiProviderMissing(false);
  }, [id]);

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
          const mapped = mapApiJobApplicationToUi(detail, profileData);
          const notesValue = mapped.metadata?.notes;

          setApp(mapped);
          setProfile(profileData);
          setNotes(typeof notesValue === "string" ? notesValue : "");
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
        await refreshBalance();
        return;
      }
      try {
        await refresh();
      } catch {
        /* ignore */
      } finally {
        await refreshBalance();
      }
    },
    onReconnect: async () => {
      try {
        await refresh();
      } finally {
        await refreshBalance();
      }
    },
  });

  async function refresh() {
    if (!id) return;
    const detail = await jobApplicationsApi.get(id);
    const profileData = await profilesApi.get(detail.profileId);
    const mapped = mapApiJobApplicationToUi(detail, profileData);
    setApp(mapped);
    setProfile(profileData);
    const notesValue = mapped.metadata?.notes;
    setNotes(typeof notesValue === "string" ? notesValue : "");
  }

  async function handleStatusChange(newStatus: string) {
    if (!id) return;
    try {
      setIsUpdatingStatus(true);
      setError(null);
      const updated = await jobApplicationsApi.update(id, {
        applicationStatus: mapUiStatusToApi(newStatus as ApplicationStatus),
      });
      const label = statusOptions.find((option) => option.value === newStatus)?.label ?? newStatus;
      setStatusUndo(updated.statusChangeId ? { eventId: updated.statusChangeId, label } : null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function handleUndoStatusChange(eventId: string) {
    if (!id) return;
    try {
      setIsUpdatingStatus(true);
      setError(null);
      await jobApplicationsApi.undoStatusChange(id, eventId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to undo the status change.");
    } finally {
      setStatusUndo(null);
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
        phone: contactForm.phone.trim() || undefined,
      });
      setContactForm({ name: "", role: "", email: "", phone: "" });
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

  async function handleSaveSalary(input: {
    salaryCurrency: string | null;
    salaryMaxAmount: number | null;
    salaryMinAmount: number | null;
    salaryPeriod: "hourly" | "monthly" | "yearly" | null;
    salaryType: "gross" | "net" | null;
  }) {
    if (!id) return;
    try {
      setIsSavingSalary(true);
      setError(null);
      await jobApplicationsApi.update(id, input);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save salary information.");
      throw e;
    } finally {
      setIsSavingSalary(false);
    }
  }

  async function handleSaveInterest(interestLevel: InterestLevel | null) {
    if (!id) return;
    try {
      setIsSavingInterest(true);
      setError(null);
      await jobApplicationsApi.update(id, { priority: interestLevel });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save interest level.");
      throw e;
    } finally {
      setIsSavingInterest(false);
    }
  }

  async function handleSaveWorkStyle(workStyle: "hybrid" | "on_site" | "remote" | null) {
    if (!id) return;
    try {
      setIsSavingWorkStyle(true);
      setError(null);
      await jobApplicationsApi.update(id, { workStyle });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save work style.");
      throw e;
    } finally {
      setIsSavingWorkStyle(false);
    }
  }

  async function handleSaveDocumentContent(documentContent: ApiDocumentContent) {
    if (!id) return;
    await jobApplicationsApi.updateDocumentContent(id, documentContent);
  }

  async function handleUpdateApplicationPack(
    documentContent: ApiDocumentContent,
    preferences: ApiApplicationPackPreferences,
  ) {
    if (!id) return;
    try {
      setIsUpdatingPack(true);
      setError(null);
      await jobApplicationsApi.requestApplicationPackGeneration(id, {
        documentContent,
        preferences,
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update application pack.");
    } finally {
      setIsUpdatingPack(false);
    }
  }

  async function handleRetry() {
    if (!id) return;
    try {
      setIsRetrying(true);
      setError(null);
      setAnalysisCreditError(false);
      setAiProviderMissing(false);
      if (app?.processingStatus === "scraped") {
        await jobApplicationsApi.startAnalysis(id);
      } else {
        await jobApplicationsApi.retry(id);
      }
      await refresh();
    } catch (e) {
      if (hasApiErrorCode(e, "payment_required")) {
        setAnalysisCreditError(true);
      } else if (hasApiErrorCode(e, "ai_provider_not_configured")) {
        setAiProviderMissing(true);
      } else {
        setError(e instanceof Error ? e.message : "Failed.");
      }
    } finally {
      setIsRetrying(false);
      void refreshBalance();
    }
  }

  async function handleDownload(docId: string) {
    if (!id) return;
    // Fetches the file and saves it via a blob-URL anchor rather than `window.open`/navigating to
    // the signed URL directly: in the desktop app, Electron's `setWindowOpenHandler` only allows
    // `https:` targets through to the system browser (see apps/desktop/src/main/index.ts), and the
    // local dev object storage endpoint is plain `http://localhost:9000` — so a signed URL opened
    // that way is silently denied, with no error and no new tab. A same-window blob download never
    // opens a new window at all, so it's unaffected by that policy (and by browser popup blockers).
    try {
      setDownloadingId(docId);
      const doc = app?.generatedDocuments?.find((d) => d.id === docId);
      if (!doc) throw new Error("Not found");
      const { url } = await jobApplicationsApi.getDocumentDownloadUrl(id, { id: doc.id });
      const response = await fetch(url);
      if (!response.ok) throw new Error("Download failed.");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = doc.name;
      anchor.click();
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleArchive() {
    if (!id) return;
    try {
      setIsChangingArchiveState(true);
      setError(null);
      await jobApplicationsApi.archive(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to archive application.");
    } finally {
      setIsChangingArchiveState(false);
    }
  }

  async function handleRestore() {
    if (!id) return;
    try {
      setIsChangingArchiveState(true);
      setError(null);
      await jobApplicationsApi.restore(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to restore application.");
    } finally {
      setIsChangingArchiveState(false);
    }
  }

  async function handlePermanentDelete() {
    if (!id) return;
    try {
      setIsDeleting(true);
      setDeleteError(null);
      await jobApplicationsApi.delete(id);
      navigate(app?.archivedAt ? "/applications/archived" : "/applications");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete application.");
    } finally {
      setIsDeleting(false);
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

  const isAnalysisQueued = app.processingStatus === "scraped" && Boolean(app.analysisAttemptId);
  const isProcessing =
    isAnalysisQueued ||
    ["queued", "scraping", "analyzing", "generating_documents"].includes(
      app.processingStatus ?? "",
    );
  const processingLabel = getProcessingLabel(app);
  const linkedInImportFailure = getLinkedInImportFailure(app);
  const sourceUrl = app.sourceUrl;
  const persistedNotes = typeof app.metadata?.notes === "string" ? app.metadata.notes.trim() : "";
  const isNotesDirty = notes.trim() !== persistedNotes;
  const isArchived = Boolean(app.archivedAt);
  const canArchive = canArchiveApplication(app);
  const canStartAnalysis =
    !isArchived && !app.aiMatch && app.processingStatus === "scraped" && !app.analysisAttemptId;

  return (
    <div className="space-y-6">
      <Link
        to={isArchived ? "/applications/archived" : "/applications"}
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to {isArchived ? "archive" : "applications"}
      </Link>

      {app.archivedAt && (
        <div className="rounded-xl border border-border bg-muted/50 p-4">
          <div>
            <p className="text-sm font-medium text-foreground">This application is archived</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Archived {new Date(app.archivedAt).toLocaleString()}. Restore it before making changes
              or starting processing.
            </p>
          </div>
        </div>
      )}

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
              {!isArchived && (
                <select
                  value={app.status}
                  onChange={(e) => void handleStatusChange(e.target.value)}
                  disabled={isUpdatingStatus}
                  className="rounded-lg border border-input bg-card px-2 py-0.5 text-xs font-medium text-foreground outline-none focus:border-ring"
                >
                  {statusOptions.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {value === app.status ? `${label} (current)` : `→ ${label}`}
                    </option>
                  ))}
                </select>
              )}
              {/* Stays after the toast is gone, so a mistaken change can be taken back later. */}
              {!isArchived &&
                app.lastStatusChange &&
                app.lastStatusChange.id !== statusUndo?.eventId && (
                  <button
                    type="button"
                    onClick={() => void handleUndoStatusChange(app.lastStatusChange!.id)}
                    disabled={isUpdatingStatus}
                    className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
                  >
                    Undo {formatApplicationStatus(app.lastStatusChange.from)} →{" "}
                    {formatApplicationStatus(app.lastStatusChange.to)}
                  </button>
                )}
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
                        ? "text-warning-emphasis"
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
          {!isArchived &&
            (app.aiMatch ? (
              <Button size="sm" onClick={() => setTab("pack")}>
                <Sparkles className="size-3.5" />
                View application pack
              </Button>
            ) : isAnalysisQueued ? (
              <Button size="sm" disabled>
                <Loader2 className="size-3.5 animate-spin" />
                Analysis queued
              </Button>
            ) : null)}
          <div ref={actionsMenuRef} className="relative">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setActionsMenuOpen((open) => !open)}
              aria-expanded={actionsMenuOpen}
              aria-haspopup="menu"
              aria-label="Application actions"
            >
              <EllipsisVertical className="size-4" />
            </Button>
            {actionsMenuOpen && (
              <div
                role="menu"
                className="absolute top-full right-0 z-50 mt-1 min-w-[140px] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg"
              >
                {isArchived ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setActionsMenuOpen(false);
                      void handleRestore();
                    }}
                    disabled={isChangingArchiveState}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ArchiveRestore className="size-3.5" />
                    {isChangingArchiveState ? "Restoring..." : "Restore"}
                  </button>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setActionsMenuOpen(false);
                      void handleArchive();
                    }}
                    disabled={!canArchive || isChangingArchiveState}
                    title={
                      canArchive
                        ? "Archive application"
                        : "Processing must finish before this application can be archived"
                    }
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Archive className="size-3.5" />
                    {isChangingArchiveState ? "Archiving..." : "Archive"}
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setActionsMenuOpen(false);
                    setDeleteDialogOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-destructive transition-colors hover:bg-danger-soft"
                >
                  <Trash2 className="size-3.5" /> Delete
                </button>
              </div>
            )}
          </div>
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

      {linkedInImportFailure && sourceUrl && (
        <LinkedInImportFallback
          failure={linkedInImportFailure}
          failureReason={app.processingFailureReason}
          isRetrying={isRetrying}
          onPaste={() => openManualPasteFlow(sourceUrl)}
          onRetry={isArchived ? undefined : () => void handleRetry()}
        />
      )}

      {app.processingStatus === "failed" && !linkedInImportFailure && (
        <div className="rounded-xl border border-destructive/20 bg-danger-soft p-4 flex items-center justify-between">
          <p className="text-sm text-destructive">
            {app.processingFailureReason ?? "Processing failed"}
          </p>
          {!isArchived && (
            <Button variant="outline" size="sm" onClick={handleRetry} disabled={isRetrying}>
              <RefreshCw className="size-3.5" />
              Retry
            </Button>
          )}
        </div>
      )}

      {(analysisCreditError ||
        (app.processingStatus === "scraped" &&
          app.analysisSkipReason === "insufficient_credits")) && (
        <div className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning-soft p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">AI analysis needs one credit</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              The scraped job is safe. Add credits, then start the analysis again.
            </p>
          </div>
          <Link className={buttonVariants({ size: "sm", variant: "outline" })} to="/billing">
            View AI credits
          </Link>
        </div>
      )}

      {(aiProviderMissing ||
        (app.processingStatus === "scraped" &&
          app.analysisSkipReason === "ai_provider_not_configured")) && (
        <div className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning-soft p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">
              Add an AI provider to analyze jobs
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              The job is saved. Add your own API key, then start the analysis.
            </p>
          </div>
          <Link className={buttonVariants({ size: "sm", variant: "outline" })} to={aiProviderPath}>
            Add API key
          </Link>
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

      {tab === "overview" && (
        <OverviewTab
          app={app}
          readOnly={isArchived}
          isSavingInterest={isSavingInterest}
          isSavingSalary={isSavingSalary}
          isSavingWorkStyle={isSavingWorkStyle}
          onSaveInterest={handleSaveInterest}
          onSaveSalary={handleSaveSalary}
          onSaveWorkStyle={handleSaveWorkStyle}
        />
      )}
      {tab === "pack" && (
        <ApplicationPackWorkspace
          app={app}
          readOnly={isArchived}
          downloadingId={downloadingId}
          isUpdating={isUpdatingPack}
          onDownload={handleDownload}
          onUpdate={handleUpdateApplicationPack}
          onProfileUpdated={setProfile}
          onSaveContent={handleSaveDocumentContent}
          onStartAnalysis={canStartAnalysis ? handleRetry : undefined}
          isStartingAnalysis={isRetrying}
          profile={profile ?? undefined}
          templates={HTML_TEMPLATES}
        />
      )}
      {tab === "timeline" && (
        <TimelineTab
          app={app}
          readOnly={isArchived}
          followUpForm={followUpForm}
          showFollowUpForm={showFollowUpForm}
          isSavingFollowUp={isSavingFollowUp}
          isSavingNotes={isSavingNotes}
          isNotesDirty={isNotesDirty}
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
          onToggleContactForm={() => {
            setContactForm({ name: "", role: "", email: "", phone: "" });
            setShowContactForm((v) => !v);
          }}
          onAddContact={handleAddContact}
          onNotesChange={setNotes}
          onSaveNotes={handleSaveNotes}
        />
      )}
      <ConfirmDialog
        confirmLabel="Delete permanently"
        description={`${app.role} at ${app.company} and all related documents will be permanently deleted.`}
        error={deleteError}
        isPending={isDeleting}
        onConfirm={() => void handlePermanentDelete()}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setDeleteError(null);
        }}
        open={deleteDialogOpen}
        title="Delete application?"
      />
      {statusUndo && (
        <UndoToast
          message={`Status changed to ${statusUndo.label}.`}
          busy={isUpdatingStatus}
          onUndo={() => void handleUndoStatusChange(statusUndo.eventId)}
          onDismiss={dismissStatusUndo}
        />
      )}
    </div>
  );
}

function parseTab(value: string | null): Tab | null {
  return tabs.some((tab) => tab.id === value) ? (value as Tab) : null;
}

// --- Sub-components ---

function OverviewTab({
  app,
  readOnly,
  isSavingInterest,
  isSavingSalary,
  isSavingWorkStyle,
  onSaveInterest,
  onSaveSalary,
  onSaveWorkStyle,
}: {
  app: JobApplication;
  readOnly: boolean;
  isSavingInterest: boolean;
  isSavingSalary: boolean;
  isSavingWorkStyle: boolean;
  onSaveInterest: (interestLevel: InterestLevel | null) => Promise<void>;
  onSaveSalary: (input: {
    salaryCurrency: string | null;
    salaryMaxAmount: number | null;
    salaryMinAmount: number | null;
    salaryPeriod: "hourly" | "monthly" | "yearly" | null;
    salaryType: "gross" | "net" | null;
  }) => Promise<void>;
  onSaveWorkStyle: (workStyle: "hybrid" | "on_site" | "remote" | null) => Promise<void>;
}) {
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
      <div className="self-start space-y-6">
        <Panel>
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
        <JobDetailsPanel
          app={app}
          readOnly={readOnly}
          isSavingInterest={isSavingInterest}
          isSavingSalary={isSavingSalary}
          isSavingWorkStyle={isSavingWorkStyle}
          onSaveInterest={onSaveInterest}
          onSaveSalary={onSaveSalary}
          onSaveWorkStyle={onSaveWorkStyle}
        />
        <CompanyDetailsPanel
          description={app.companyDescription}
          websiteUrl={app.companyWebsiteUrl}
        />
      </div>
    </div>
  );
}

const companyDescriptionCollapseThreshold = 300;

export function CompanyDetailsPanel({
  description,
  websiteUrl,
}: {
  description?: string;
  websiteUrl?: string;
}) {
  const content = description?.trim() ?? "";
  const website = websiteUrl?.trim() ?? "";
  const descriptionId = useId();
  const [isExpanded, setIsExpanded] = useState(false);
  const isCollapsible = content.length > companyDescriptionCollapseThreshold;

  useEffect(() => {
    setIsExpanded(false);
  }, [content]);

  if (!content && !website) {
    return null;
  }

  return (
    <Panel>
      <PanelHeader title="Company details" />
      <div className="divide-y divide-border border-t border-border text-sm">
        {website && (
          <div className="flex items-center justify-between gap-4 px-5 py-2.5">
            <span className="shrink-0 text-muted-foreground">Company website</span>
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              title={website}
              className="inline-flex min-w-0 items-center gap-1 font-medium text-primary hover:underline"
            >
              <span className="truncate">{website}</span>
              <ExternalLink className="size-3.5 shrink-0" />
            </a>
          </div>
        )}
        {content && (
          <div className="px-5 py-4">
            <p
              id={descriptionId}
              className={cn(
                "text-sm leading-relaxed text-muted-foreground",
                isCollapsible && !isExpanded && "line-clamp-5",
              )}
            >
              {content}
            </p>
            {isCollapsible && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="-ml-2 mt-2 h-auto py-0"
                aria-controls={descriptionId}
                aria-expanded={isExpanded}
                onClick={() => setIsExpanded((expanded) => !expanded)}
              >
                {isExpanded ? "Show less" : "Show more"}
              </Button>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}

const currencyCodes = Intl.supportedValuesOf("currency");
const currencyNames = new Intl.DisplayNames(["en"], { type: "currency" });
const currencyOptions: UnifiedSelectOption[] = currencyCodes.map((code) => ({
  value: code,
  label: `${code} · ${currencyNames.of(code) ?? code}`,
  leading: currencyFlag(code),
  searchText: currencyNames.of(code),
}));
const salaryPeriodOptions: UnifiedSelectOption[] = [
  { value: "hourly", label: "Hourly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];
const salaryTypeOptions: UnifiedSelectOption[] = [
  { value: "gross", label: "Gross" },
  { value: "net", label: "Net" },
];
const workStyleOptions: UnifiedSelectOption[] = [
  { value: "not_set", label: "Not set" },
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "on_site", label: "On-site" },
];
const interestOptions: UnifiedSelectOption[] = [
  { value: "not_set", label: "Not set" },
  { value: "low", label: "Low interest", leading: "🤔" },
  { value: "medium", label: "Interested", leading: "👀" },
  { value: "high", label: "Highly interested", leading: "🔥" },
];

export function JobDetailsPanel({
  app,
  readOnly = false,
  isSavingInterest,
  isSavingSalary,
  isSavingWorkStyle,
  onSaveInterest,
  onSaveSalary,
  onSaveWorkStyle,
}: {
  app: JobApplication;
  readOnly?: boolean;
  isSavingInterest: boolean;
  isSavingSalary: boolean;
  isSavingWorkStyle: boolean;
  onSaveInterest: Parameters<typeof OverviewTab>[0]["onSaveInterest"];
  onSaveSalary: Parameters<typeof OverviewTab>[0]["onSaveSalary"];
  onSaveWorkStyle: Parameters<typeof OverviewTab>[0]["onSaveWorkStyle"];
}) {
  const [minimum, setMinimum] = useState("");
  const [maximum, setMaximum] = useState("");
  const [currency, setCurrency] = useState("");
  const [period, setPeriod] = useState("");
  const [salaryType, setSalaryType] = useState("");
  const [interestLevel, setInterestLevel] = useState("");
  const [workStyle, setWorkStyle] = useState("");
  const [editingField, setEditingField] = useState<"interest" | "salary" | "workStyle" | null>(
    null,
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setMinimum(app.salaryMinAmount?.toString() ?? "");
    setMaximum(app.salaryMaxAmount?.toString() ?? "");
    setCurrency(app.salaryCurrency ?? "");
    setPeriod(app.salaryPeriod ?? "");
    setSalaryType(app.salaryType ?? "");
  }, [
    app.id,
    app.salaryCurrency,
    app.salaryMaxAmount,
    app.salaryMinAmount,
    app.salaryPeriod,
    app.salaryType,
  ]);

  useEffect(() => {
    setInterestLevel(app.interestLevel ?? "not_set");
  }, [app.id, app.interestLevel]);

  useEffect(() => {
    setWorkStyle(app.workStyle ?? "not_set");
  }, [app.id, app.workStyle]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const hasMinimum = minimum.trim() !== "";
    const hasMaximum = maximum.trim() !== "";
    const isClear = !hasMinimum && !hasMaximum && !currency && !period && !salaryType;
    const parsedMinimum = hasMinimum ? Number(minimum) : null;
    const parsedMaximum = hasMaximum ? Number(maximum) : null;

    if (!isClear && !hasMinimum && !hasMaximum) {
      setValidationError("Enter at least one salary amount.");
      return;
    }
    if (!isClear && (!currency || !currencyCodes.includes(currency))) {
      setValidationError("Choose a valid currency.");
      return;
    }
    if (!isClear && !period) {
      setValidationError("Choose a pay period.");
      return;
    }
    if (!isClear && !salaryType) {
      setValidationError("Choose gross or net salary.");
      return;
    }
    if (
      (parsedMinimum !== null && !Number.isFinite(parsedMinimum)) ||
      (parsedMaximum !== null && !Number.isFinite(parsedMaximum))
    ) {
      setValidationError("Enter valid salary amounts.");
      return;
    }
    if (
      (parsedMinimum !== null && parsedMinimum < 0) ||
      (parsedMaximum !== null && parsedMaximum < 0)
    ) {
      setValidationError("Salary amounts cannot be negative.");
      return;
    }
    if (parsedMinimum !== null && parsedMaximum !== null && parsedMinimum > parsedMaximum) {
      setValidationError("Maximum salary must be at least the minimum salary.");
      return;
    }

    setValidationError(null);
    try {
      await onSaveSalary({
        salaryMinAmount: isClear ? null : parsedMinimum,
        salaryMaxAmount: isClear ? null : parsedMaximum,
        salaryCurrency: isClear ? null : currency,
        salaryPeriod: isClear ? null : (period as "hourly" | "monthly" | "yearly"),
        salaryType: isClear ? null : (salaryType as "gross" | "net"),
      });
      setEditingField(null);
    } catch {
      // The page-level error message is shown while the draft remains editable.
    }
  }

  async function handleInterestSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!interestLevel) return;
    try {
      await onSaveInterest(interestLevel === "not_set" ? null : (interestLevel as InterestLevel));
      setEditingField(null);
    } catch {
      // The page-level error message is shown while the draft remains editable.
    }
  }

  async function handleWorkStyleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!workStyle) return;
    try {
      await onSaveWorkStyle(
        workStyle === "not_set" ? null : (workStyle as "hybrid" | "on_site" | "remote"),
      );
      setEditingField(null);
    } catch {
      // The page-level error message is shown while the draft remains editable.
    }
  }

  const salaryValue = formatSalary(app);

  if (readOnly) {
    return (
      <Panel>
        <PanelHeader title="Job details" />
        <dl className="divide-y divide-border border-t border-border text-sm">
          {[
            ["Interest", app.interestLevel ?? "Not set"],
            ["Salary", salaryValue],
            ["Work style", app.workStyle ? formatWorkStyle(app.workStyle) : "Not set"],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 px-5 py-2.5">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right font-medium text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelHeader title="Job details" />
      <div className="divide-y divide-border border-t border-border text-sm">
        {editingField === "salary" ? (
          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 px-5 py-4">
            <div>
              <p className="mb-3 text-sm font-medium text-foreground">Salary</p>
              <div className="grid grid-cols-2 gap-3">
                <SalaryInput label="Minimum" value={minimum} onChange={setMinimum} />
                <SalaryInput label="Maximum" value={maximum} onChange={setMaximum} />
              </div>
            </div>
            <UnifiedSelect
              label="Currency"
              options={currencyOptions}
              placeholder="Select currency"
              value={currency}
              onChange={setCurrency}
            />
            <UnifiedSelect
              label="Pay period"
              options={salaryPeriodOptions}
              placeholder="Select period"
              value={period}
              onChange={setPeriod}
            />
            <UnifiedSelect
              label="Salary type"
              options={salaryTypeOptions}
              placeholder="Select gross or net"
              value={salaryType}
              onChange={setSalaryType}
            />
            {validationError && <p className="text-xs text-destructive">{validationError}</p>}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSavingSalary}
                className="flex-1"
                onClick={() => {
                  setMinimum(app.salaryMinAmount?.toString() ?? "");
                  setMaximum(app.salaryMaxAmount?.toString() ?? "");
                  setCurrency(app.salaryCurrency ?? "");
                  setPeriod(app.salaryPeriod ?? "");
                  setSalaryType(app.salaryType ?? "");
                  setValidationError(null);
                  setEditingField(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSavingSalary} className="flex-1">
                {isSavingSalary && <Loader2 className="size-4 animate-spin" />}
                {isSavingSalary ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-4 px-5 py-2.5">
            <span className="text-muted-foreground">Salary</span>
            <span className="flex items-center gap-2 text-right font-medium text-foreground">
              <span>{salaryValue}</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Edit salary"
                onClick={() => {
                  setInterestLevel(app.interestLevel ?? "not_set");
                  setEditingField("salary");
                }}
              >
                <Pencil className="size-3.5" />
              </Button>
            </span>
          </div>
        )}

        {editingField === "workStyle" ? (
          <form
            onSubmit={(event) => void handleWorkStyleSubmit(event)}
            className="space-y-4 px-5 py-4"
          >
            <UnifiedSelect
              label="Work style"
              options={workStyleOptions}
              placeholder="Select work style"
              value={workStyle}
              onChange={setWorkStyle}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSavingWorkStyle}
                className="flex-1"
                onClick={() => {
                  setWorkStyle(app.workStyle ?? "not_set");
                  setEditingField(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSavingWorkStyle || !workStyle}
                className="flex-1"
              >
                {isSavingWorkStyle && <Loader2 className="size-4 animate-spin" />}
                {isSavingWorkStyle ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-4 px-5 py-2.5">
            <span className="text-muted-foreground">Work style</span>
            <span className="flex items-center gap-2 text-right font-medium text-foreground">
              <span>{formatWorkStyle(app.workStyle)}</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Edit work style"
                onClick={() => {
                  setWorkStyle(app.workStyle ?? "not_set");
                  setEditingField("workStyle");
                }}
              >
                <Pencil className="size-3.5" />
              </Button>
            </span>
          </div>
        )}

        {editingField === "interest" ? (
          <form
            onSubmit={(event) => void handleInterestSubmit(event)}
            className="space-y-4 px-5 py-4"
          >
            <UnifiedSelect
              label="Interest level"
              options={interestOptions}
              placeholder="Select interest level"
              value={interestLevel}
              onChange={setInterestLevel}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSavingInterest}
                className="flex-1"
                onClick={() => {
                  setInterestLevel(app.interestLevel ?? "not_set");
                  setEditingField(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSavingInterest || !interestLevel}
                className="flex-1"
              >
                {isSavingInterest && <Loader2 className="size-4 animate-spin" />}
                {isSavingInterest ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-4 px-5 py-2.5">
            <span className="text-muted-foreground">Interest level</span>
            <span className="flex items-center gap-2 text-right font-medium text-foreground">
              <span>{formatInterestLevel(app.interestLevel)}</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Edit interest level"
                onClick={() => {
                  setMinimum(app.salaryMinAmount?.toString() ?? "");
                  setMaximum(app.salaryMaxAmount?.toString() ?? "");
                  setCurrency(app.salaryCurrency ?? "");
                  setPeriod(app.salaryPeriod ?? "");
                  setSalaryType(app.salaryType ?? "");
                  setValidationError(null);
                  setEditingField("interest");
                }}
              >
                <Pencil className="size-3.5" />
              </Button>
            </span>
          </div>
        )}
      </div>
    </Panel>
  );
}

function formatInterestLevel(interestLevel?: InterestLevel): string {
  const option = interestOptions.find((item) => item.value === interestLevel);
  return option ? `${option.leading} ${option.label}` : "Not set";
}

function formatWorkStyle(workStyle?: JobApplication["workStyle"]): string {
  return workStyleOptions.find((item) => item.value === workStyle)?.label ?? "Not set";
}

function formatSalary(app: JobApplication): string {
  if (app.salaryMinAmount === undefined && app.salaryMaxAmount === undefined) return "Not set";
  const formatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  });
  const amounts = [app.salaryMinAmount, app.salaryMaxAmount]
    .filter((amount): amount is number => amount !== undefined)
    .map((amount) => formatter.format(amount))
    .join(" – ");
  const currency = app.salaryCurrency ? ` ${app.salaryCurrency}` : "";
  const period = app.salaryPeriod ? ` / ${app.salaryPeriod.replace("ly", "")}` : "";
  const salaryType = app.salaryType ? ` · ${app.salaryType === "gross" ? "Gross" : "Net"}` : "";
  return `${amounts}${currency}${period}${salaryType}`;
}

function currencyFlag(currencyCode: string): string {
  const regionOverrides: Record<string, string> = {
    EUR: "EU",
    GBP: "GB",
    USD: "US",
  };
  const region = regionOverrides[currencyCode] ?? currencyCode.slice(0, 2);
  if (!/^[A-Z]{2}$/.test(region) || currencyCode.startsWith("X")) return "🌐";
  return String.fromCodePoint(...[...region].map((letter) => letter.charCodeAt(0) + 127397));
}

function SalaryInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-xs font-medium text-muted-foreground">
      {label}
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="0.00"
        className="mt-1.5 h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
      />
    </label>
  );
}

function TimelineTab({
  app,
  readOnly,
  followUpForm,
  showFollowUpForm,
  isSavingFollowUp,
  isSavingNotes,
  isNotesDirty,
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
  readOnly: boolean;
  followUpForm: { id: string; title: string; description: string; nextFollowUpAt: string };
  showFollowUpForm: boolean;
  isSavingFollowUp: boolean;
  isSavingNotes: boolean;
  isNotesDirty: boolean;
  contactForm: { name: string; role: string; email: string; phone: string };
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
  onSetContactForm: (f: { name: string; role: string; email: string; phone: string }) => void;
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
            !readOnly ? (
              <Button variant="ghost" size="sm" onClick={onToggleFollowUpForm}>
                + Add follow-up
              </Button>
            ) : undefined
          }
        />
        {!readOnly && showFollowUpForm && (
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
                Careerden will notify you automatically 10 minutes before this time.
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
        {(!app.followUps || app.followUps.length === 0) &&
          !showFollowUpForm &&
          (readOnly ? (
            <p className="border-t border-border px-5 py-4 text-sm text-muted-foreground">
              No follow-ups were scheduled before this application was archived.
            </p>
          ) : (
            <FollowUpsEmptyState onAdd={onToggleFollowUpForm} />
          ))}
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
                {!readOnly && (
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
                )}
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
              !readOnly ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void onSaveNotes()}
                  disabled={isSavingNotes || !isNotesDirty}
                >
                  {isSavingNotes ? "Saving..." : "Save"}
                </Button>
              ) : undefined
            }
          />
          <div className="border-t border-border px-5 py-4">
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              readOnly={readOnly}
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
              !readOnly ? (
                <Button variant="ghost" size="sm" onClick={onToggleContactForm}>
                  + Add
                </Button>
              ) : undefined
            }
          />
          {!readOnly && showContactForm && (
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
              <input
                placeholder="Phone"
                type="tel"
                value={contactForm.phone}
                onChange={(e) => onSetContactForm({ ...contactForm, phone: e.target.value })}
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
                    {c.phone && <p className="truncate text-xs text-muted-foreground">{c.phone}</p>}
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

export function FollowUpsEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="border-t border-border px-6 py-10 text-center">
      <div
        className="relative mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15 dark:bg-primary/20 dark:ring-primary/25"
        aria-hidden="true"
      >
        <CalendarPlus2 className="size-8" strokeWidth={1.75} />
        <span className="absolute -right-1 -top-1 size-3 rounded-full bg-primary/20 ring-4 ring-card dark:bg-primary/35" />
        <span className="absolute -bottom-1 -left-1 size-2 rounded-full bg-primary/15 ring-4 ring-card dark:bg-primary/30" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-foreground">No follow-ups scheduled</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground">
        Schedule a check-in after applying or interviewing. Careerden will remind you 10 minutes
        before it is due.
      </p>
      <Button variant="outline" size="sm" className="mt-5" onClick={onAdd}>
        <CalendarPlus2 className="size-4" />
        Schedule your first follow-up
      </Button>
    </div>
  );
}
// --- helpers ---

const statusOptions: Array<{ value: ApplicationStatus; label: string }> = [
  { value: "Saved", label: "Saved" },
  { value: "Applied", label: "Applied" },
  { value: "Interviewing", label: "Interviewing" },
  { value: "Offer", label: "Offer" },
  { value: "Declined", label: "Offer declined" },
  { value: "Rescinded", label: "Offer rescinded" },
  { value: "Rejected", label: "Rejected" },
  { value: "Ghosted", label: "Ghosted" },
];

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
    case "Declined":
      return "declined";
    case "Rescinded":
      return "rescinded";
    case "Rejected":
      return "rejected";
    case "Ghosted":
      return "ghosted";
    default:
      return "saved";
  }
}

function canArchiveApplication(app: JobApplication): boolean {
  if (app.processingStatus === "scraped") return !app.analysisAttemptId;
  return ["review_ready", "completed", "failed"].includes(app.processingStatus ?? "");
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
  if (app.processingStatus === "scraped" && app.analysisAttemptId) {
    return "AI analysis queued";
  }

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
