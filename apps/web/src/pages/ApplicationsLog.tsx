import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button.js";
import { StatusBadge, PriorityTag } from "../components/link2cv/status-badge.js";
import type { DisplayStatus, DisplayPriority } from "../components/link2cv/status-badge.js";
import { jobApplicationsApi } from "../api/jobApplications.js";
import { profilesApi } from "../api/profiles.js";
import { mapApiJobApplicationToUi } from "../api/mappers.js";
import {
  useJobApplicationChanges,
  type JobApplicationChange,
} from "../api/jobApplicationChanges.js";
import { cn } from "../lib/utils.js";
import { Search, ArrowUpDown, EllipsisVertical, SlidersHorizontal, Trash2 } from "lucide-react";
import type { JobApplication } from "../types.js";
import type { ApiApplicationStatus } from "../api/types.js";

type SortKey = "recent" | "match" | "company";

const filters: { id: DisplayStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "processing", label: "Processing" },
  { id: "ready", label: "Ready" },
  { id: "applied", label: "Applied" },
  { id: "interview", label: "Interviewing" },
  { id: "rejected", label: "Not selected" },
];

export default function ApplicationsLog() {
  const navigate = useNavigate();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DisplayStatus | "all">("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const loadSequence = useRef(0);

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
        if (filter === "applied") apiStatus = "applied" as ApiApplicationStatus;
        else if (filter === "interview") apiStatus = "interview" as ApiApplicationStatus;
        else if (filter === "offer") apiStatus = "offer" as ApiApplicationStatus;
        else if (filter === "rejected") apiStatus = "rejected" as ApiApplicationStatus;
        const items = await jobApplicationsApi.list({
          profileId,
          applicationStatus: apiStatus,
        });
        if (sequence === loadSequence.current) {
          const mapped = items.map((item) => mapApiJobApplicationToUi(item));
          let filtered = mapped;
          if (filter === "processing") {
            filtered = mapped.filter((a) =>
              ["queued", "scraping", "analyzing", "generating_documents"].includes(
                a.processingStatus ?? "",
              ),
            );
          } else if (filter === "ready") {
            filtered = mapped.filter((a) => a.processingStatus === "review_ready");
          }
          setApplications(filtered);
        }
      } catch (e) {
        if (sequence === loadSequence.current) {
          setError(e instanceof Error ? e.message : "Failed to load.");
        }
      } finally {
        if (showLoading && sequence === loadSequence.current) setIsLoading(false);
      }
    },
    [filter, profileId],
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
    onChange: async (change: JobApplicationChange) => {
      if (change.type === "application.deleted") {
        setApplications((c) => c.filter((a) => a.id !== change.applicationId));
        return;
      }
      try {
        const detail = await jobApplicationsApi.get(change.applicationId);
        const updated = mapApiJobApplicationToUi(detail);
        setApplications((c) => {
          const without = c.filter((a) => a.id !== updated.id);
          return [...without, updated].sort((a, b) =>
            (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
          );
        });
      } catch {
        /* ignore realtime race */
      }
    },
    onReconnect: () => loadApplications(false),
  });

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
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

  const handleDelete = useCallback(async (id: string) => {
    try {
      await jobApplicationsApi.delete(id);
      setOpenMenuId(null);
      setApplications((c) => c.filter((a) => a.id !== id));
    } catch {
      // keep row visible on error
    }
  }, []);

  const rows = useMemo(() => {
    let list = applications.filter((a) => {
      const q = query.toLowerCase();
      return !q || a.company.toLowerCase().includes(q) || a.role.toLowerCase().includes(q);
    });
    list = [...list].sort((a, b) => {
      if (sort === "match") return (b.matchScore ?? 0) - (a.matchScore ?? 0);
      if (sort === "company") return a.company.localeCompare(b.company);
      return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
    });
    return list;
  }, [applications, query, sort]);

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

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-input bg-card px-2.5 py-1.5">
            <ArrowUpDown className="size-3.5 text-muted-foreground" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
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
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
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

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="hidden grid-cols-12 gap-4 border-b border-border px-5 py-2.5 text-xs font-medium text-muted-foreground md:grid">
          <div className="col-span-4">Company & role</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Match</div>
          <div className="col-span-1">Priority</div>
          <div className="col-span-1">Follow-up</div>
          <div className="col-span-1 text-right">Added</div>
          <div className="col-span-1 text-center">Actions</div>
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

          {rows.map((app) => {
            const isProcessing = [
              "queued",
              "scraping",
              "analyzing",
              "generating_documents",
            ].includes(app.processingStatus ?? "");
            const isFailed = app.processingStatus === "failed";
            return (
              <button
                key={app.id}
                onClick={() => navigate(`/applications/${app.id}`)}
                className={cn(
                  "grid w-full grid-cols-1 items-center gap-2 px-5 py-3.5 text-left transition-colors hover:bg-muted/50 md:grid-cols-12 md:gap-4",
                  isProcessing && "bg-info-soft/30 hover:bg-info-soft/50",
                  isFailed && "bg-danger-soft hover:bg-danger-soft/70",
                )}
              >
                <div className="col-span-4 flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary text-xs font-semibold text-secondary-foreground">
                    {app.logo ? (
                      <img src={app.logo} alt="" className="size-full object-contain" />
                    ) : (
                      app.company.slice(0, 2)
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{app.role}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {app.company} · {app.location}
                    </p>
                  </div>
                </div>
                <div className="col-span-2">
                  <StatusBadge status={mapUiStatusToDisplay(app)} />
                </div>
                <div className="col-span-2 text-sm text-foreground">
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
                <div className="col-span-1">
                  <PriorityTag priority={mapUiPriorityToDisplay(app.priority)} />
                </div>
                <div className="col-span-1 text-xs text-muted-foreground">
                  {app.dateLabel || "—"}
                </div>
                <div className="col-span-1 flex items-center justify-end gap-1 text-xs text-muted-foreground">
                  {app.dateApplied.replace(/, \d{4}$/, "")}
                </div>
                <div
                  className="col-span-1 flex items-center justify-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="relative">
                    <button
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
                        <button
                          onClick={() => handleDelete(app.id)}
                          className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-destructive transition-colors hover:bg-danger-soft"
                        >
                          <Trash2 className="size-3.5" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {rows.length} of {applications.length} applications
      </p>
    </div>
  );
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
    default:
      return "saved";
  }
}

function mapUiPriorityToDisplay(priority: string): DisplayPriority {
  switch (priority) {
    case "High":
      return "high";
    case "Low":
      return "low";
    case "Mid":
      return "medium";
    default:
      return "medium";
  }
}

function matchScoreBarColor(score: number): string {
  if (score >= 70) return "bg-success";
  if (score >= 50) return "bg-warning";
  return "bg-destructive";
}

function matchScoreTextColor(score: number): string {
  if (score >= 70) return "text-success";
  if (score >= 50) return "text-warning-foreground";
  return "text-destructive";
}
