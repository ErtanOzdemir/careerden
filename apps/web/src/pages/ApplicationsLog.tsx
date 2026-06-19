import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ApplicationStatus } from "../types";
import StatusBadge from "../components/StatusBadge";
import CompanyLogo from "../components/CompanyLogo";
import Pagination from "../components/Pagination";
import { requireDefaultProfileId } from "../api/config";
import { jobApplicationsApi } from "../api/jobApplications";
import { mapApiJobApplicationToUi, mapUiStatusToApi } from "../api/mappers";

const statuses: (ApplicationStatus | "All")[] = [
  "All",
  "Applied",
  "Interviewing",
  "Offer",
  "Rejected",
];

type ViewMode = "grid" | "list";

export default function ApplicationsLog() {
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [sourceUrl, setSourceUrl] = useState("");
  const [applications, setApplications] = useState<ReturnType<typeof mapApiJobApplicationToUi>[]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  useEffect(() => {
    let isMounted = true;

    async function loadApplications() {
      try {
        setIsLoading(true);
        setError(null);

        const profileId = requireDefaultProfileId();
        const items = await jobApplicationsApi.list({
          profileId,
          applicationStatus:
            statusFilter === "All"
              ? undefined
              : mapUiStatusToApi(statusFilter as ApplicationStatus),
        });

        if (isMounted) {
          setApplications(items.map((item) => mapApiJobApplicationToUi(item)));
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load applications.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadApplications();

    return () => {
      isMounted = false;
    };
  }, [statusFilter]);

  async function handleQuickAdd() {
    try {
      setIsSaving(true);
      setError(null);

      const created = await jobApplicationsApi.create({
        profileId: requireDefaultProfileId(),
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
                      className="hover:bg-surface-container-low transition-colors group"
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
                      </td>
                      <td className="px-6 py-4">
                        <MatchScore score={app.matchScore} />
                      </td>
                      <td className="px-6 py-4">
                        <ApplicationTags tags={app.tags} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          className="material-symbols-outlined p-2 text-secondary hover:text-primary hover:bg-primary-fixed rounded-full transition-all cursor-pointer"
                          title="Application actions"
                          type="button"
                        >
                          more_vert
                        </button>
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
                  className="flex min-h-72 flex-col rounded-xl border border-outline-variant bg-white p-lg shadow-sm transition-shadow hover:shadow-md"
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
                    <MatchScore score={app.matchScore} />
                  </div>

                  <Link className="mt-lg block" to={`/applications/${app.id}`}>
                    <h4 className="font-headline-md text-on-surface">{app.role}</h4>
                    <p className="mt-1 flex items-center gap-1 text-body-md text-secondary">
                      <span className="material-symbols-outlined text-[18px]">location_on</span>
                      <span className="truncate">{app.location}</span>
                    </p>
                  </Link>

                  <div className="mt-md flex flex-wrap items-center justify-between gap-sm">
                    <StatusBadge status={app.status} />
                    <div className="text-right">
                      <div className="text-label-md text-on-surface">{app.dateApplied}</div>
                      <div className="text-label-sm text-secondary">{app.dateLabel}</div>
                    </div>
                  </div>

                  <div className="mt-md min-h-7">
                    <ApplicationTags tags={app.tags} />
                  </div>

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

function MatchScore({ score }: { score?: number }) {
  if (score === undefined) {
    return <span className="text-label-sm text-outline">Not analyzed</span>;
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
