import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ApplicationStatus, Priority } from "../types";
import StatusBadge from "../components/StatusBadge";
import CompanyLogo from "../components/CompanyLogo";
import Pagination from "../components/Pagination";
import { requireDefaultProfileId } from "../api/config";
import { jobApplicationsApi } from "../api/jobApplications";
import { mapApiJobApplicationToUi, mapUiPriorityToApi, mapUiStatusToApi } from "../api/mappers";

const statuses: (ApplicationStatus | "All")[] = [
  "All",
  "Applied",
  "Interviewing",
  "Offer",
  "Rejected",
];

const priorities: (Priority | "All")[] = ["All", "High", "Mid", "Low"];

const priorityStars: Record<Priority, string> = {
  High: "text-tertiary-container fill",
  Mid: "text-tertiary-container fill",
  Low: "text-outline",
};

export default function ApplicationsLog() {
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [priorityFilter, setPriorityFilter] = useState<string>("All");
  const [sourceUrl, setSourceUrl] = useState("");
  const [applications, setApplications] = useState<ReturnType<typeof mapApiJobApplicationToUi>[]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
          priority:
            priorityFilter === "All" ? undefined : mapUiPriorityToApi(priorityFilter as Priority),
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
  }, [priorityFilter, statusFilter]);

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
          <div className="relative">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="appearance-none bg-surface-container-low border border-outline-variant text-label-md py-2 pl-3 pr-8 rounded-lg focus:ring-2 focus:ring-primary cursor-pointer"
            >
              {priorities.map((p) => (
                <option key={p}>{p === "All" ? `Priority: ${p}` : p}</option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-secondary text-sm">
              star
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
            <button className="p-2 bg-secondary-container text-primary border-r border-outline-variant cursor-pointer">
              <span className="material-symbols-outlined text-[20px]">list</span>
            </button>
            <button className="p-2 hover:bg-surface-container-low transition-colors cursor-pointer">
              <span className="material-symbols-outlined text-[20px]">grid_view</span>
            </button>
          </div>
        </div>
      </section>

      <section className="bg-white border border-outline-variant rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="bg-surface-container-low border-b border-outline-variant">
              <tr>
                {["Company", "Role", "Date Applied", "Status", "Priority", "Tags", ""].map((h) => (
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
                    <td className="px-6 py-4 text-center">
                      <span className={`material-symbols-outlined ${priorityStars[app.priority]}`}>
                        star
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {app.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded bg-surface-container text-[10px] font-bold text-secondary border border-outline-variant"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="material-symbols-outlined p-2 text-secondary hover:text-primary hover:bg-primary-fixed rounded-full transition-all cursor-pointer">
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
    </div>
  );
}
