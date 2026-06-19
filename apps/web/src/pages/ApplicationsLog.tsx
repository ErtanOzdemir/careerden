import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import type { ApplicationStatus, JobApplication } from "../types";
import StatusBadge from "../components/StatusBadge";
import CompanyLogo from "../components/CompanyLogo";
import Pagination from "../components/Pagination";
import { requireDefaultProfileId } from "../api/config";
import { jobApplicationsApi } from "../api/jobApplications";
import { useJobApplicationChanges, type JobApplicationChange } from "../api/jobApplicationChanges";
import { mapApiJobApplicationToUi, mapUiStatusToApi } from "../api/mappers";

const statuses: (ApplicationStatus | "All")[] = [
  "All",
  "Applied",
  "Interviewing",
  "Offer",
  "Rejected",
];

type ViewMode = "grid" | "list";

interface ApplicationActionState {
  applicationId: string;
  action: string;
}

export default function ApplicationsLog() {
  const profileId = requireDefaultProfileId();
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [sourceUrl, setSourceUrl] = useState("");
  const [applications, setApplications] = useState<ReturnType<typeof mapApiJobApplicationToUi>[]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [activeAction, setActiveAction] = useState<ApplicationActionState | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadApplications = useCallback(
    async (showLoading = false) => {
      try {
        if (showLoading) {
          setIsLoading(true);
        }
        setError(null);

        const items = await jobApplicationsApi.list({
          profileId,
          applicationStatus:
            statusFilter === "All"
              ? undefined
              : mapUiStatusToApi(statusFilter as ApplicationStatus),
        });

        setApplications(items.map((item) => mapApiJobApplicationToUi(item)));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load applications.");
      } finally {
        if (showLoading) {
          setIsLoading(false);
        }
      }
    },
    [profileId, statusFilter],
  );

  useEffect(() => {
    void loadApplications(true);
  }, [loadApplications]);

  const handleRealtimeChange = useCallback(
    async (change: JobApplicationChange) => {
      if (change.type === "application.deleted") {
        setApplications((current) => current.filter((item) => item.id !== change.applicationId));
        return;
      }

      try {
        const detail = await jobApplicationsApi.get(change.applicationId);
        const updated = mapApiJobApplicationToUi(detail);
        const matchesFilter =
          statusFilter === "All" || updated.status === (statusFilter as ApplicationStatus);

        setApplications((current) => {
          const withoutUpdated = current.filter((item) => item.id !== updated.id);

          if (!matchesFilter) {
            return withoutUpdated;
          }

          return [...withoutUpdated, updated].sort((left, right) =>
            (right.updatedAt ?? "").localeCompare(left.updatedAt ?? ""),
          );
        });
      } catch {
        // Reconnect reconciliation or a later event will restore authoritative state.
      }
    },
    [statusFilter],
  );

  useJobApplicationChanges(profileId, {
    onChange: handleRealtimeChange,
    onOpen: () => loadApplications(false),
  });

  async function handleQuickAdd() {
    try {
      setIsSaving(true);
      setError(null);

      const created = await jobApplicationsApi.create({
        profileId,
        sourceUrl: sourceUrl.trim() || undefined,
      });

      setApplications((current) => [mapApiJobApplicationToUi(created), ...current]);
      setSourceUrl("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to create application.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStatusChange(application: JobApplication, status: ApplicationStatus) {
    try {
      setActiveAction({ applicationId: application.id, action: `status-${status}` });
      setActionMessage(null);
      setActionError(null);

      await jobApplicationsApi.update(application.id, {
        applicationStatus: mapUiStatusToApi(status),
      });

      setApplications((current) => {
        if (statusFilter !== "All" && statusFilter !== status) {
          return current.filter((item) => item.id !== application.id);
        }

        return current.map((item) => (item.id === application.id ? { ...item, status } : item));
      });
      setActionMessage(`${application.company} moved to ${status}.`);
    } catch (updateError) {
      setActionError(
        updateError instanceof Error ? updateError.message : "Failed to update status.",
      );
    } finally {
      setActiveAction(null);
    }
  }

  async function handleGenerateDocuments(application: JobApplication) {
    try {
      setActiveAction({ applicationId: application.id, action: "generate-documents" });
      setActionMessage(null);
      setActionError(null);

      const detail = await jobApplicationsApi.generateDocuments(application.id);
      const updated = mapApiJobApplicationToUi(detail);

      setApplications((current) =>
        current.map((item) => (item.id === application.id ? updated : item)),
      );
      setActionMessage(`Documents generated for ${application.company}.`);
    } catch (generateError) {
      setActionError(
        generateError instanceof Error ? generateError.message : "Failed to generate documents.",
      );
    } finally {
      setActiveAction(null);
    }
  }

  async function handleDelete(application: JobApplication) {
    const confirmed = window.confirm(
      `Delete ${application.company} — ${application.role}? This also removes its timeline, contacts, interviews, and generated documents.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setActiveAction({ applicationId: application.id, action: "delete" });
      setActionMessage(null);
      setActionError(null);

      await jobApplicationsApi.delete(application.id);
      setApplications((current) => current.filter((item) => item.id !== application.id));
      setActionMessage(`${application.company} was deleted.`);
    } catch (deleteError) {
      setActionError(
        deleteError instanceof Error ? deleteError.message : "Failed to delete application.",
      );
    } finally {
      setActiveAction(null);
    }
  }

  async function handleRetry(application: JobApplication) {
    try {
      setActiveAction({ applicationId: application.id, action: "retry" });
      setActionMessage(null);
      setActionError(null);

      const retried = await jobApplicationsApi.retry(application.id);
      const updated = mapApiJobApplicationToUi(retried);

      setApplications((current) =>
        current.map((item) => (item.id === application.id ? updated : item)),
      );
      setActionMessage(`${application.company} was queued to run again from the beginning.`);
    } catch (retryError) {
      setActionError(
        retryError instanceof Error ? retryError.message : "Failed to retry application.",
      );
    } finally {
      setActiveAction(null);
    }
  }

  return (
    <div className="animate-fade-in">
      <section className="mt-lg mb-2xl">
        <div className="relative rounded-2xl overflow-hidden bg-white/80 backdrop-blur border border-outline-variant p-xl shadow-sm">
          <div className="absolute top-0 right-0 w-1/3 h-full opacity-5 pointer-events-none">
            <svg height="100%" preserveAspectRatio="none" viewBox="0 0 100 100" width="100%">
              <defs>
                <pattern height="10" id="grid" patternUnits="userSpaceOnUse" width="10">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect fill="url(#grid)" height="100" width="100" />
            </svg>
          </div>
          <div className="relative z-10">
            <h2 className="font-display font-headline-lg text-headline-lg mb-sm">
              Track a New Application
            </h2>
            <p className="font-body-md text-secondary mb-lg max-w-[42rem]">
              Paste a LinkedIn job link to automatically extract role details, or manually add a
              quick entry to your log.
            </p>
            <div className="flex flex-col md:flex-row gap-4 max-w-4xl">
              <div className="flex-1 relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary font-bold">
                  link
                </span>
                <input
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white border border-outline-variant rounded-xl text-body-md focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                  placeholder="Paste LinkedIn Job Link"
                  type="text"
                />
              </div>
              <button
                onClick={handleQuickAdd}
                disabled={isSaving}
                className="bg-primary-container text-on-primary font-bold px-8 py-4 rounded-xl shadow-lg hover:translate-y-[-2px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined">bolt</span>
                {isSaving ? "Adding..." : "Quick Add"}
              </button>
            </div>
            {error && <p className="mt-md text-body-md text-error">{error}</p>}
          </div>
        </div>
      </section>

      <section className="mb-lg flex flex-wrap items-center justify-between gap-4 p-md bg-white border border-outline-variant rounded-xl shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none bg-surface-container-low border border-outline-variant text-label-md py-2 pl-3 pr-8 rounded-lg focus:ring-2 focus:ring-primary cursor-pointer"
            >
              {statuses.map((s) => (
                <option key={s}>{s === "All" ? `Status: ${s}` : s}</option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-secondary text-sm">
              expand_more
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container border border-outline-variant rounded-lg text-label-md cursor-pointer hover:bg-surface-container-high">
            <span className="material-symbols-outlined text-[18px]">filter_list</span>
            More Filters
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-label-sm text-secondary font-medium">
            {applications.length} Applications Total
          </div>
          <div className="flex border border-outline-variant rounded-lg overflow-hidden">
            <button
              aria-label="List view"
              aria-pressed={viewMode === "list"}
              className={`border-r border-outline-variant p-2 transition-colors cursor-pointer ${
                viewMode === "list"
                  ? "bg-secondary-container text-primary"
                  : "text-secondary hover:bg-surface-container-low"
              }`}
              onClick={() => setViewMode("list")}
              title="List view"
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">list</span>
            </button>
            <button
              aria-label="Grid view"
              aria-pressed={viewMode === "grid"}
              className={`p-2 transition-colors cursor-pointer ${
                viewMode === "grid"
                  ? "bg-secondary-container text-primary"
                  : "text-secondary hover:bg-surface-container-low"
              }`}
              onClick={() => setViewMode("grid")}
              title="Grid view"
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">grid_view</span>
            </button>
          </div>
        </div>
      </section>

      {actionMessage && (
        <div
          className="mb-lg flex items-center justify-between gap-3 rounded-xl border border-success-outline bg-success-container px-md py-sm text-body-md text-on-success-container"
          role="status"
        >
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">check_circle</span>
            {actionMessage}
          </span>
          <button
            aria-label="Dismiss message"
            className="material-symbols-outlined rounded-full p-1 text-[18px] hover:bg-white/50"
            onClick={() => setActionMessage(null)}
            type="button"
          >
            close
          </button>
        </div>
      )}

      {actionError && (
        <div
          className="mb-lg flex items-center justify-between gap-3 rounded-xl border border-error/40 bg-error-container px-md py-sm text-body-md text-on-error-container"
          role="alert"
        >
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">error</span>
            {actionError}
          </span>
          <button
            aria-label="Dismiss error"
            className="material-symbols-outlined rounded-full p-1 text-[18px] hover:bg-white/50"
            onClick={() => setActionError(null)}
            type="button"
          >
            close
          </button>
        </div>
      )}

      {viewMode === "list" ? (
        <section className="bg-white border border-outline-variant rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead className="bg-surface-container-low border-b border-outline-variant">
                <tr>
                  {["Company", "Role", "Date Applied", "Status", "Match", "Tags", ""].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-4 text-label-md text-secondary font-bold uppercase tracking-wider"
                    >
                      {h ? (
                        <div className="flex items-center gap-1 cursor-pointer hover:text-primary transition-colors">
                          {h}
                          <span className="material-symbols-outlined text-sm">
                            {h === "Company" ? "expand_more" : "unfold_more"}
                          </span>
                        </div>
                      ) : (
                        <div className="text-right">Actions</div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {isLoading && (
                  <tr>
                    <td className="px-6 py-8 text-center text-secondary" colSpan={7}>
                      Loading applications...
                    </td>
                  </tr>
                )}
                {!isLoading && applications.length === 0 && (
                  <tr>
                    <td className="px-6 py-8 text-center text-secondary" colSpan={7}>
                      No applications found.
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  applications.map((app) => (
                    <tr
                      key={app.id}
                      title={
                        isBackgroundProcessing(app)
                          ? `Background processing: ${app.processingStatusLabel}`
                          : undefined
                      }
                      className={`group transition-colors ${
                        app.processingStatus === "failed"
                          ? "bg-error-container/40 hover:bg-error-container/60"
                          : isBackgroundProcessing(app)
                            ? "application-processing-row"
                            : "hover:bg-surface-container-low"
                      }`}
                    >
                      <td className="px-6 py-4">
                        <Link to={`/applications/${app.id}`} className="flex items-center gap-3">
                          <CompanyLogo
                            className="h-10 w-10 shrink-0 text-sm"
                            company={app.company}
                            logo={app.logo}
                          />
                          <div>
                            <div className="text-body-md font-bold">{app.company}</div>
                            <div className="text-label-sm text-secondary">{app.domain}</div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <Link to={`/applications/${app.id}`} className="block">
                          <div className="text-body-md font-medium">{app.role}</div>
                          <div className="text-label-sm text-secondary">{app.location}</div>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-body-md">{app.dateApplied}</div>
                        <div className="text-label-sm text-secondary">{app.dateLabel}</div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={app.status} />
                        {isBackgroundProcessing(app) && (
                          <span className="sr-only">
                            Background processing: {app.processingStatusLabel}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <ApplicationMatch application={app} />
                      </td>
                      <td className="px-6 py-4">
                        <ApplicationTags tags={app.tags} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {app.processingStatus === "failed" && (
                            <RetryButton
                              activeAction={activeAction}
                              application={app}
                              onRetry={handleRetry}
                            />
                          )}
                          <ApplicationActions
                            activeAction={activeAction}
                            application={app}
                            onDelete={handleDelete}
                            onGenerateDocuments={handleGenerateDocuments}
                            onRetry={handleRetry}
                            onStatusChange={handleStatusChange}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <Pagination current={1} total={applications.length} pageSize={10} />
        </section>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-md md:grid-cols-2 xl:grid-cols-3">
            {isLoading && (
              <div className="col-span-full rounded-xl border border-outline-variant bg-white p-xl text-center text-secondary">
                Loading applications...
              </div>
            )}
            {!isLoading && applications.length === 0 && (
              <div className="col-span-full rounded-xl border border-outline-variant bg-white p-xl text-center text-secondary">
                No applications found.
              </div>
            )}
            {!isLoading &&
              applications.map((app) => (
                <article
                  key={app.id}
                  className={`flex min-h-72 flex-col rounded-xl border p-lg shadow-sm transition-shadow hover:shadow-md ${
                    app.processingStatus === "failed"
                      ? "border-error/30 bg-error-container/40"
                      : "border-outline-variant bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-md">
                    <Link
                      className="flex min-w-0 items-center gap-3"
                      to={`/applications/${app.id}`}
                    >
                      <CompanyLogo
                        className="h-12 w-12 shrink-0 text-base"
                        company={app.company}
                        logo={app.logo}
                      />
                      <div className="min-w-0">
                        <h3 className="truncate text-body-md font-bold text-on-surface">
                          {app.company}
                        </h3>
                        <p className="truncate text-label-sm text-secondary">{app.domain}</p>
                      </div>
                    </Link>
                    <div className="flex shrink-0 items-center gap-1">
                      <ApplicationMatch application={app} />
                      <ApplicationActions
                        activeAction={activeAction}
                        application={app}
                        onDelete={handleDelete}
                        onGenerateDocuments={handleGenerateDocuments}
                        onRetry={handleRetry}
                        onStatusChange={handleStatusChange}
                      />
                    </div>
                  </div>

                  <Link className="mt-lg block" to={`/applications/${app.id}`}>
                    <h4 className="font-headline-md text-on-surface">{app.role}</h4>
                    <p className="mt-1 flex items-center gap-1 text-body-md text-secondary">
                      <span className="material-symbols-outlined text-[18px]">location_on</span>
                      <span className="truncate">{app.location}</span>
                    </p>
                  </Link>

                  <div className="mt-md flex flex-wrap items-center justify-between gap-sm">
                    <div className="flex flex-col items-start gap-1.5">
                      <StatusBadge status={app.status} />
                      <ProcessingStatus application={app} />
                    </div>
                    <div className="text-right">
                      <div className="text-label-md text-on-surface">{app.dateApplied}</div>
                      <div className="text-label-sm text-secondary">{app.dateLabel}</div>
                    </div>
                  </div>

                  <div className="mt-md min-h-7">
                    <ApplicationTags tags={app.tags} />
                  </div>

                  {app.processingStatus === "failed" && (
                    <div className="mt-md flex justify-end">
                      <RetryButton
                        activeAction={activeAction}
                        application={app}
                        onRetry={handleRetry}
                      />
                    </div>
                  )}

                  <Link
                    className="mt-auto flex items-center justify-end gap-1 pt-lg text-label-md font-bold text-primary hover:underline"
                    to={`/applications/${app.id}`}
                  >
                    View application
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </Link>
                </article>
              ))}
          </section>
          <div className="mt-lg overflow-hidden rounded-xl border border-outline-variant">
            <Pagination current={1} total={applications.length} pageSize={10} />
          </div>
        </>
      )}
    </div>
  );
}

function RetryButton(props: {
  activeAction: ApplicationActionState | null;
  application: JobApplication;
  onRetry: (application: JobApplication) => Promise<void>;
}) {
  const isRetrying =
    props.activeAction?.applicationId === props.application.id &&
    props.activeAction.action === "retry";

  return (
    <button
      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-label-md font-bold text-on-primary shadow-sm transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
      disabled={isRetrying}
      onClick={() => void props.onRetry(props.application)}
      title="Rerun processing from the beginning"
      type="button"
    >
      <span className="material-symbols-outlined text-[18px]">
        {isRetrying ? "progress_activity" : "restart_alt"}
      </span>
      {isRetrying ? "Retrying..." : "Retry"}
    </button>
  );
}

function ApplicationMatch({ application }: { application: JobApplication }) {
  if (
    !["review_ready", "generating_documents", "completed"].includes(
      application.processingStatus ?? "",
    )
  ) {
    return null;
  }

  return <MatchScore score={application.matchScore} />;
}

function isBackgroundProcessing(application: JobApplication): boolean {
  return ["queued", "scraping", "analyzing", "generating_documents"].includes(
    application.processingStatus ?? "",
  );
}

function ProcessingStatus({ application }: { application: JobApplication }) {
  if (!application.processingStatusLabel) {
    return null;
  }

  const isFailed = application.processingStatus === "failed";
  const isActive = isBackgroundProcessing(application);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-label-sm font-bold ${
        isFailed
          ? "bg-error-container text-on-error-container"
          : isActive
            ? "bg-secondary-container text-primary"
            : "bg-surface-container-high text-secondary"
      }`}
    >
      {isActive && (
        <span className="material-symbols-outlined animate-spin text-[13px]">
          progress_activity
        </span>
      )}
      {application.processingStatusLabel}
    </span>
  );
}

function ApplicationActions(props: {
  activeAction: ApplicationActionState | null;
  application: JobApplication;
  onDelete: (application: JobApplication) => Promise<void>;
  onGenerateDocuments: (application: JobApplication) => Promise<void>;
  onRetry: (application: JobApplication) => Promise<void>;
  onStatusChange: (application: JobApplication, status: ApplicationStatus) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isApplicationBusy = props.activeAction?.applicationId === props.application.id;

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    function updatePosition() {
      const rect = buttonRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      const menuWidth = 256;
      const menuHeight = menuRef.current?.offsetHeight ?? 440;
      const viewportPadding = 8;
      const left = Math.min(
        Math.max(viewportPadding, rect.right - menuWidth),
        window.innerWidth - menuWidth - viewportPadding,
      );
      const fitsBelow = rect.bottom + menuHeight + viewportPadding <= window.innerHeight;

      setPosition({
        left,
        top: fitsBelow ? rect.bottom + 6 : Math.max(viewportPadding, rect.top - menuHeight - 6),
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function runAction(action: () => Promise<void>) {
    setIsOpen(false);
    void action();
  }

  return (
    <>
      <button
        ref={buttonRef}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Actions for ${props.application.company}`}
        className="material-symbols-outlined rounded-full p-2 text-secondary transition-all hover:bg-primary-fixed hover:text-primary disabled:cursor-wait disabled:opacity-60"
        disabled={isApplicationBusy}
        onClick={() => setIsOpen((current) => !current)}
        title="Application actions"
        type="button"
      >
        {isApplicationBusy ? "progress_activity" : "more_vert"}
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            aria-label={`Actions for ${props.application.company}`}
            className="fixed z-[60] isolate w-64 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest py-2 text-left opacity-100 shadow-2xl"
            role="menu"
            style={{ ...position, backgroundColor: "#ffffff" }}
          >
            <Link
              className="flex items-center gap-3 px-4 py-2.5 text-body-md font-medium text-on-surface hover:bg-surface-container-low"
              onClick={() => setIsOpen(false)}
              role="menuitem"
              to={`/applications/${props.application.id}`}
            >
              <span className="material-symbols-outlined text-[20px] text-primary">visibility</span>
              View application
            </Link>

            <div className="my-1 border-t border-outline-variant" />
            <div className="px-4 pb-1 pt-2 text-label-sm font-bold uppercase tracking-wider text-outline">
              Change status
            </div>
            {statuses
              .filter((status): status is ApplicationStatus => status !== "All")
              .map((status) => {
                const isCurrent = props.application.status === status;
                const isUpdating =
                  props.activeAction?.applicationId === props.application.id &&
                  props.activeAction.action === `status-${status}`;

                return (
                  <button
                    key={status}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-body-md text-on-surface hover:bg-surface-container-low disabled:cursor-default disabled:opacity-60"
                    disabled={isCurrent || isApplicationBusy}
                    onClick={() => runAction(() => props.onStatusChange(props.application, status))}
                    role="menuitem"
                    type="button"
                  >
                    <span className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[18px] text-secondary">
                        {statusIcon(status)}
                      </span>
                      {status}
                    </span>
                    {(isCurrent || isUpdating) && (
                      <span className="material-symbols-outlined text-[18px] text-primary">
                        {isUpdating ? "progress_activity" : "check"}
                      </span>
                    )}
                  </button>
                );
              })}

            {props.application.processingStatus === "review_ready" && (
              <>
                <div className="my-1 border-t border-outline-variant" />
                <button
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-body-md font-medium text-primary hover:bg-primary-fixed disabled:cursor-wait disabled:opacity-60"
                  disabled={isApplicationBusy}
                  onClick={() => runAction(() => props.onGenerateDocuments(props.application))}
                  role="menuitem"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[20px]">description</span>
                  Generate documents
                </button>
              </>
            )}

            {props.application.processingStatus === "failed" && (
              <>
                <div className="my-1 border-t border-outline-variant" />
                <button
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-body-md font-medium text-primary hover:bg-primary-fixed disabled:cursor-wait disabled:opacity-60"
                  disabled={isApplicationBusy}
                  onClick={() => runAction(() => props.onRetry(props.application))}
                  role="menuitem"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[20px]">restart_alt</span>
                  Retry processing
                </button>
              </>
            )}

            <div className="my-1 border-t border-outline-variant" />
            <button
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-body-md font-medium text-error hover:bg-error-container disabled:cursor-wait disabled:opacity-60"
              disabled={isApplicationBusy}
              onClick={() => runAction(() => props.onDelete(props.application))}
              role="menuitem"
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">delete</span>
              Delete application
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}

function statusIcon(status: ApplicationStatus) {
  switch (status) {
    case "Applied":
      return "send";
    case "Interviewing":
      return "record_voice_over";
    case "Offer":
      return "celebration";
    case "Rejected":
      return "cancel";
  }
}

function MatchScore({ score }: { score?: number }) {
  if (score === undefined) {
    return null;
  }

  const colorClass =
    score >= 70
      ? "border-success-outline bg-success-container text-on-success-container"
      : score >= 50
        ? "border-tertiary/40 bg-tertiary-fixed text-on-tertiary-fixed-variant"
        : "border-error/50 bg-error-container text-on-error-container";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-label-sm font-bold ${colorClass}`}
    >
      <span className="material-symbols-outlined text-[15px]">analytics</span>
      {score}% Match
    </span>
  );
}

function ApplicationTags({ tags }: { tags: string[] }) {
  if (tags.length === 0) {
    return <span className="text-label-sm text-outline">No tags</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="px-2 py-0.5 rounded bg-surface-container text-[10px] font-bold text-secondary border border-outline-variant"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}
