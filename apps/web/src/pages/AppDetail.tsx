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
import type { InterestLevel, JobApplication, Profile } from "../types.js";
import { mapUiStatusToApi } from "../api/mappers.js";
import { cn } from "../lib/utils.js";
import AiMatchCard from "../components/AiMatchCard.js";
import { ScrapedHtmlDescription } from "../components/ScrapedHtmlDescription.js";
import { UnifiedSelect, type UnifiedSelectOption } from "../components/link2cv/unified-select.js";
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
  { id: "timeline", label: "Follow-ups & notes" },
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
  const [isSavingSalary, setIsSavingSalary] = useState(false);
  const [isSavingInterest, setIsSavingInterest] = useState(false);
  const [isSavingWorkStyle, setIsSavingWorkStyle] = useState(false);
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
    onReconnect: () => refresh(),
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
          newStatus as "Saved" | "Applied" | "Interviewing" | "Offer" | "Rejected" | "Ghosted",
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
                {["Saved", "Applied", "Interviewing", "Offer", "Rejected", "Ghosted"].map((s) => (
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

      {tab === "overview" && (
        <OverviewTab
          app={app}
          isSavingInterest={isSavingInterest}
          isSavingSalary={isSavingSalary}
          isSavingWorkStyle={isSavingWorkStyle}
          onSaveInterest={handleSaveInterest}
          onSaveSalary={handleSaveSalary}
          onSaveWorkStyle={handleSaveWorkStyle}
        />
      )}
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

function OverviewTab({
  app,
  isSavingInterest,
  isSavingSalary,
  isSavingWorkStyle,
  onSaveInterest,
  onSaveSalary,
  onSaveWorkStyle,
}: {
  app: JobApplication;
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
          isSavingInterest={isSavingInterest}
          isSavingSalary={isSavingSalary}
          isSavingWorkStyle={isSavingWorkStyle}
          onSaveInterest={onSaveInterest}
          onSaveSalary={onSaveSalary}
          onSaveWorkStyle={onSaveWorkStyle}
        />
      </div>
    </div>
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
  isSavingInterest,
  isSavingSalary,
  isSavingWorkStyle,
  onSaveInterest,
  onSaveSalary,
  onSaveWorkStyle,
}: {
  app: JobApplication;
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

  return (
    <Panel>
      <PanelHeader title="Job details" />
      <div className="divide-y divide-border border-t border-border text-sm">
        {app.companyWebsiteUrl && (
          <div className="flex items-center justify-between gap-4 px-5 py-2.5">
            <span className="shrink-0 text-muted-foreground">Company website</span>
            <a
              href={app.companyWebsiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={app.companyWebsiteUrl}
              className="inline-flex min-w-0 items-center gap-1 font-medium text-primary hover:underline"
            >
              <span className="truncate">{app.companyWebsiteUrl}</span>
              <ExternalLink className="size-3.5 shrink-0" />
            </a>
          </div>
        )}

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
    case "Ghosted":
      return "ghosted";
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
