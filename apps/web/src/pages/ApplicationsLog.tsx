import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../components/ui/button.js";
import { ConfirmDialog } from "../components/ui/confirm-dialog.js";
import { InterestTag, StatusBadge } from "../components/careerden/status-badge.js";
import type { DisplayStatus } from "../components/careerden/status-badge.js";
import { jobApplicationsApi } from "../api/jobApplications.js";
import { profilesApi } from "../api/profiles.js";
import { useCreditBalance } from "../billing/CreditBalanceProvider.js";
import { mapApiJobApplicationToUi } from "../api/mappers.js";
import {
  useJobApplicationChanges,
  type JobApplicationChange,
} from "../api/jobApplicationChanges.js";
import { cn } from "../lib/utils.js";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Archive,
  ArchiveRestore,
  EllipsisVertical,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import type { JobApplication } from "../types.js";
import type { ApiApplicationStatus } from "../api/types.js";

type SortKey = "recent" | "match" | "company";
const PAGE_SIZE = 20;
const processingStatuses = ["queued", "scraping", "analyzing", "generating_documents"];
const applicationsGridColumns =
  "md:grid-cols-[minmax(0,3fr)_minmax(0,1.5fr)_minmax(0,1.7fr)_minmax(0,1.8fr)_minmax(0,2.2fr)_minmax(0,0.9fr)_minmax(0,0.6fr)]";

const filters: { id: DisplayStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "processing", label: "Processing" },
  { id: "ready", label: "Ready" },
  { id: "saved", label: "Saved" },
  { id: "applied", label: "Applied" },
  { id: "interview", label: "Interviewing" },
  { id: "rejected", label: "Not selected" },
  { id: "ghosted", label: "Ghosted" },
];

export default function ApplicationsLog({ archiveMode = false }: { archiveMode?: boolean }) {
  const { refreshBalance } = useCreditBalance();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const visibleFilters = archiveMode
    ? filters.filter((candidate) => candidate.id !== "processing")
    : filters;
  const filter = parseFilter(searchParams.get("status"), visibleFilters);
  const sort = parseSort(searchParams.get("sort"));
  const page = parsePage(searchParams.get("page"));
  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const loadSequence = useRef(0);

  const updateSearchParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(updates)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      });
    },
    [setSearchParams],
  );

  useEffect(() => setQuery(urlQuery), [urlQuery]);

  useEffect(() => {
    if (query === urlQuery) return;
    const timer = window.setTimeout(() => {
      updateSearchParams({ q: query.trim() || undefined, page: undefined });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, updateSearchParams, urlQuery]);

  useEffect(() => {
    let isMounted = true;
    profilesApi
      .me()
      .then((p) => {
        if (isMounted) setProfileId(p.id);
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

  const loadApplications = useCallback(
    async (showLoading = true) => {
      if (!profileId) return;
      const sequence = ++loadSequence.current;
      try {
        if (showLoading) setIsLoading(true);
        setError(null);
        let apiStatus: ApiApplicationStatus | undefined;
        if (filter === "saved") apiStatus = "saved";
        else if (filter === "applied") apiStatus = "applied";
        else if (filter === "interview") apiStatus = "interview" as ApiApplicationStatus;
        else if (filter === "offer") apiStatus = "offer" as ApiApplicationStatus;
        else if (filter === "rejected") apiStatus = "rejected" as ApiApplicationStatus;
        else if (filter === "ghosted") apiStatus = "ghosted";
        const result = await jobApplicationsApi.list({
          profileId,
          archiveState: archiveMode ? "archived" : "active",
          applicationStatus: apiStatus,
          processingStatuses:
            filter === "processing"
              ? processingStatuses.join(",")
              : filter === "ready"
                ? "review_ready"
                : undefined,
          search: urlQuery || undefined,
          page,
          pageSize: PAGE_SIZE,
          sortBy:
            sort === "match"
              ? "matchScore"
              : sort === "company"
                ? "companyName"
                : archiveMode
                  ? "archivedAt"
                  : "updatedAt",
          sortDirection: sort === "company" ? "asc" : "desc",
        });
        if (sequence === loadSequence.current) {
          if (page > Math.max(result.totalPages, 1)) {
            updateSearchParams({
              page: result.totalPages > 1 ? String(result.totalPages) : undefined,
            });
            return;
          }
          setApplications(result.items.map((item) => mapApiJobApplicationToUi(item)));
          setTotalItems(result.totalItems);
          setTotalPages(result.totalPages);
        }
      } catch (e) {
        if (sequence === loadSequence.current) {
          setError(e instanceof Error ? e.message : "Failed to load.");
        }
      } finally {
        if (showLoading && sequence === loadSequence.current) setIsLoading(false);
      }
    },
    [archiveMode, filter, page, profileId, sort, updateSearchParams, urlQuery],
  );

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadApplications(false);
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => document.removeEventListener("visibilitychange", refreshWhenVisible);
  }, [loadApplications]);

  useJobApplicationChanges(profileId ?? undefined, {
    onChange: async (_change: JobApplicationChange) => {
      await loadApplications(false);
      await refreshBalance();
    },
    onReconnect: async () => {
      await loadApplications(false);
      await refreshBalance();
    },
  });

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<JobApplication | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    }
    if (openMenuId) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openMenuId]);

  const handleArchive = useCallback(
    async (id: string) => {
      try {
        await jobApplicationsApi.archive(id);
        setOpenMenuId(null);
        await loadApplications(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to archive application.");
      }
    },
    [loadApplications],
  );

  const handleRestore = useCallback(
    async (id: string) => {
      try {
        await jobApplicationsApi.restore(id);
        setOpenMenuId(null);
        await loadApplications(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to restore application.");
      }
    },
    [loadApplications],
  );

  const handleDelete = useCallback(async () => {
    if (!deleteCandidate) return;
    try {
      setIsDeleting(true);
      setDeleteError(null);
      await jobApplicationsApi.delete(deleteCandidate.id);
      setDeleteCandidate(null);
      setOpenMenuId(null);
      await loadApplications(false);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete application.");
    } finally {
      setIsDeleting(false);
    }
  }, [deleteCandidate, loadApplications]);

  const rows = useMemo(() => applications, [applications]);
  const visibleRows = isLoading ? [] : rows;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search company or role..."
            className="h-9 w-full rounded-lg border border-input bg-card pr-3 pl-9 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20 lg:w-72"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(archiveMode ? "/applications" : "/applications/archived")}
          >
            {archiveMode ? <ArrowLeft className="size-3.5" /> : <Archive className="size-3.5" />}
            {archiveMode ? "Active applications" : "Archived applications"}
          </Button>
          <div className="flex items-center gap-1.5 rounded-lg border border-input bg-card px-2.5 py-1.5">
            <ArrowUpDown className="size-3.5 text-muted-foreground" />
            <select
              value={sort}
              onChange={(e) =>
                updateSearchParams({
                  sort: e.target.value === "recent" ? undefined : e.target.value,
                  page: undefined,
                })
              }
              className="bg-transparent text-sm text-foreground outline-none"
            >
              <option value="recent">Most recent</option>
              <option value="match">Highest match</option>
              <option value="company">Company A–Z</option>
            </select>
          </div>
          <Button variant="outline" size="sm">
            <SlidersHorizontal className="size-3.5" />
            Filters
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {visibleFilters.map((f) => (
          <button
            key={f.id}
            onClick={() =>
              updateSearchParams({
                status: f.id === "all" ? undefined : f.id,
                page: undefined,
              })
            }
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              filter === f.id
                ? "border-primary/30 bg-accent text-accent-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-danger-soft p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card">
        <div
          className={cn(
            "hidden gap-4 border-b border-border px-5 py-2.5 text-xs font-medium text-muted-foreground md:grid",
            applicationsGridColumns,
          )}
        >
          <div>Company & role</div>
          <div>Status</div>
          <div>Match</div>
          <div>Interest</div>
          <div className="md:pl-2">Salary</div>
          <div className="text-right">{archiveMode ? "Archived" : "Added"}</div>
          <div className="text-center">Actions</div>
        </div>

        <div className="divide-y divide-border">
          {isLoading && (
            <div className="px-5 py-16 text-center text-sm text-muted-foreground">
              Loading applications...
            </div>
          )}

          {!isLoading && rows.length === 0 && (
            <div className="px-5 py-16 text-center">
              <p className="text-sm font-medium text-foreground">No applications found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try adjusting your search or filters.
              </p>
            </div>
          )}

          {visibleRows.map((app) => {
            const isProcessing =
              (app.processingStatus === "scraped" && Boolean(app.analysisAttemptId)) ||
              ["queued", "scraping", "analyzing", "generating_documents"].includes(
                app.processingStatus ?? "",
              );
            const isFailed = app.processingStatus === "failed";
            return (
              <div
                aria-label={`${app.role} at ${app.company}`}
                key={app.id}
                onClick={() => navigate(`/applications/${app.id}`)}
                onKeyDown={(event) => {
                  if (
                    event.target === event.currentTarget &&
                    (event.key === "Enter" || event.key === " ")
                  ) {
                    event.preventDefault();
                    navigate(`/applications/${app.id}`);
                  }
                }}
                role="link"
                tabIndex={0}
                className={cn(
                  "grid w-full grid-cols-1 items-center gap-2 px-5 py-3.5 text-left transition-colors hover:bg-muted/50 md:gap-4",
                  applicationsGridColumns,
                  isProcessing && "bg-info-soft/30 hover:bg-info-soft/50",
                  isFailed && "bg-danger-soft hover:bg-danger-soft/70",
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <ApplicationCompanyLogo company={app.company} logo={app.logo} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{app.role}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {app.company} · {app.location}
                    </p>
                  </div>
                </div>
                <div className="min-w-0">
                  <StatusBadge status={mapUiStatusToDisplay(app)} />
                </div>
                <div className="min-w-0 text-sm text-foreground">
                  {(app.matchScore ?? 0) > 0 ? (
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                        <span
                          className={cn(
                            "block h-full rounded-full",
                            matchScoreBarColor(app.matchScore ?? 0),
                          )}
                          style={{ width: `${app.matchScore}%` }}
                        />
                      </span>
                      <span
                        className={cn(
                          "text-xs font-medium",
                          matchScoreTextColor(app.matchScore ?? 0),
                        )}
                      >
                        {app.matchScore}%
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                <div className="min-w-0">
                  <InterestTag interestLevel={app.interestLevel} />
                </div>
                <div
                  className="min-w-0 truncate text-xs text-muted-foreground md:pl-2"
                  title={formatSalary(app)}
                >
                  {formatSalary(app)}
                </div>
                <div className="flex min-w-0 items-center justify-end gap-1 text-xs text-muted-foreground">
                  {(archiveMode && app.archivedAt
                    ? new Date(app.archivedAt).toLocaleDateString()
                    : app.dateApplied
                  ).replace(/, \d{4}$/, "")}
                </div>
                <div
                  className="flex min-w-0 items-center justify-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenMenuId(openMenuId === app.id ? null : app.id)}
                      className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Actions"
                    >
                      <EllipsisVertical className="size-4" />
                    </button>
                    {openMenuId === app.id && (
                      <div
                        ref={menuRef}
                        className="absolute top-full right-0 z-50 min-w-[120px] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg"
                      >
                        {archiveMode ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleRestore(app.id)}
                              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                            >
                              <ArchiveRestore className="size-3.5" />
                              Restore
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteError(null);
                                setDeleteCandidate(app);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-destructive transition-colors hover:bg-danger-soft"
                            >
                              <Trash2 className="size-3.5" />
                              Delete
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleArchive(app.id)}
                              disabled={!canArchiveApplication(app)}
                              title={
                                canArchiveApplication(app)
                                  ? "Archive application"
                                  : "Processing must finish before this application can be archived"
                              }
                              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Archive className="size-3.5" />
                              Archive
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteError(null);
                                setDeleteCandidate(app);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-destructive transition-colors hover:bg-danger-soft"
                            >
                              <Trash2 className="size-3.5" />
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {totalItems === 0
            ? "Showing 0 applications"
            : `Showing ${(page - 1) * PAGE_SIZE + 1}-${Math.min(page * PAGE_SIZE, totalItems)} of ${totalItems} applications`}
        </p>
        {totalPages > 1 && (
          <nav className="flex items-center gap-1" aria-label="Applications pagination">
            <Button
              variant="outline"
              size="icon"
              disabled={page <= 1 || isLoading}
              onClick={() =>
                updateSearchParams({ page: page === 2 ? undefined : String(page - 1) })
              }
              aria-label="Previous page"
            >
              <ArrowLeft className="size-4" />
            </Button>
            {paginationItems(page, totalPages).map((item, index) =>
              item === "ellipsis" ? (
                <span
                  key={`ellipsis-${index}`}
                  className="flex size-9 items-center justify-center text-sm text-muted-foreground"
                >
                  ...
                </span>
              ) : (
                <Button
                  key={item}
                  variant={item === page ? "default" : "outline"}
                  size="icon"
                  disabled={isLoading}
                  onClick={() =>
                    updateSearchParams({ page: item === 1 ? undefined : String(item) })
                  }
                  aria-label={`Page ${item}`}
                  aria-current={item === page ? "page" : undefined}
                >
                  {item}
                </Button>
              ),
            )}
            <Button
              variant="outline"
              size="icon"
              disabled={page >= totalPages || isLoading}
              onClick={() => updateSearchParams({ page: String(page + 1) })}
              aria-label="Next page"
            >
              <ArrowRight className="size-4" />
            </Button>
          </nav>
        )}
      </div>

      <ConfirmDialog
        confirmLabel="Delete permanently"
        description={
          deleteCandidate
            ? `${deleteCandidate.role} at ${deleteCandidate.company} and all related documents will be permanently deleted.`
            : "This application will be permanently deleted."
        }
        error={deleteError}
        isPending={isDeleting}
        onConfirm={() => void handleDelete()}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteCandidate(null);
            setDeleteError(null);
          }
        }}
        open={Boolean(deleteCandidate)}
        title="Delete application?"
      />
    </div>
  );
}

function parseFilter(
  value: string | null,
  availableFilters: typeof filters,
): DisplayStatus | "all" {
  return availableFilters.some((filter) => filter.id === value)
    ? (value as DisplayStatus | "all")
    : "all";
}

function parseSort(value: string | null): SortKey {
  return value === "match" || value === "company" ? value : "recent";
}

function parsePage(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function paginationItems(page: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((item) => item > 0 && item <= totalPages).sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];
  for (const item of sorted) {
    const previous = result.at(-1);
    if (typeof previous === "number" && item - previous > 1) result.push("ellipsis");
    result.push(item);
  }
  return result;
}

function mapUiStatusToDisplay(app: JobApplication): DisplayStatus {
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

function canArchiveApplication(app: JobApplication): boolean {
  if (app.processingStatus === "scraped") return !app.analysisAttemptId;
  return ["review_ready", "completed", "failed"].includes(app.processingStatus ?? "");
}

function matchScoreBarColor(score: number): string {
  if (score >= 70) return "bg-success";
  if (score >= 50) return "bg-warning";
  return "bg-destructive";
}

function matchScoreTextColor(score: number): string {
  if (score >= 70) return "text-success";
  if (score >= 50) return "text-warning-emphasis";
  return "text-destructive";
}

function formatSalary(app: JobApplication): string {
  if (app.salaryMinAmount === undefined && app.salaryMaxAmount === undefined) return "—";

  const amounts = [app.salaryMinAmount, app.salaryMaxAmount]
    .filter((amount): amount is number => amount !== undefined)
    .map((amount) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(amount))
    .join(" – ");
  const currency = app.salaryCurrency ? ` ${app.salaryCurrency}` : "";
  const period = app.salaryPeriod ? ` / ${app.salaryPeriod.replace("ly", "")}` : "";
  const salaryType = app.salaryType ? ` · ${app.salaryType === "gross" ? "Gross" : "Net"}` : "";

  return `${amounts}${currency}${period}${salaryType}`;
}

function ApplicationCompanyLogo({ company, logo }: { company: string; logo?: string }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [logo]);

  const showLogo = Boolean(logo) && !hasError;

  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg text-xs font-semibold",
        showLogo
          ? "border border-black/10 bg-white p-0.5"
          : "bg-secondary text-secondary-foreground",
      )}
    >
      {showLogo ? (
        <img
          src={logo}
          alt={`${company} logo`}
          className="size-full object-contain"
          onError={() => setHasError(true)}
        />
      ) : (
        <span aria-hidden="true">{company.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}
