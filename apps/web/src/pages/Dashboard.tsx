import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button.js";
import { Panel, PanelHeader } from "../components/careerden/panel.js";
import { StatusBadge } from "../components/careerden/status-badge.js";
import { ApplicationPipelineSankey } from "../components/ApplicationPipelineSankey.js";
import { FollowUpCalendar, type CalendarFollowUp } from "../components/FollowUpCalendar.js";
import type { DisplayStatus } from "../components/careerden/status-badge.js";
import { jobApplicationsApi } from "../api/jobApplications.js";
import { profilesApi } from "../api/profiles.js";
import { mapApiJobApplicationToUi, mapApiDashboardStats } from "../api/mappers.js";
import type { JobApplication, DashboardStats } from "../types.js";
import type { ApiProfile } from "../api/types.js";
import { OnboardingChecklist } from "../onboarding/OnboardingChecklist.js";
import { cn } from "../lib/utils.js";
import {
  Link2,
  ArrowRight,
  FileCheck2,
  Sparkles,
  Send,
  FilePlus2,
  CalendarDays,
} from "lucide-react";

const activityIcon = {
  generated: FileCheck2,
  interview: CalendarDays,
  match: Sparkles,
  added: FilePlus2,
  applied: Send,
  ghosted: FileCheck2,
};

const pipelineLogosStorageKey = "careerden.dashboard.pipelineCompanyLogos";

// A per-browser display preference: storage can be missing or blocked, so it falls back to the
// default and still works for the current visit.
function useStoredFlag(key: string, defaultValue: boolean) {
  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored === null ? defaultValue : stored === "true";
    } catch {
      return defaultValue;
    }
  });

  function update(next: boolean) {
    setValue(next);
    try {
      window.localStorage.setItem(key, String(next));
    } catch {
      // The preference only lasts for this visit.
    }
  }

  return [value, update] as const;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [profile, setProfile] = useState<ApiProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCompanyLogos, setShowCompanyLogos] = useStoredFlag(pipelineLogosStorageKey, true);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setIsLoading(true);
        const profile = await profilesApi.me();
        const [listPage, analytics] = await Promise.all([
          jobApplicationsApi.list({ profileId: profile.id, pageSize: 25 }),
          jobApplicationsApi.analytics(profile.id),
        ]);
        const details = await Promise.all(listPage.items.map((a) => jobApplicationsApi.get(a.id)));
        const mappedDetails = details.map((d) => mapApiJobApplicationToUi(d));

        if (isMounted) {
          setProfile(profile);
          setApplications(mappedDetails);
          setStats(mapApiDashboardStats(analytics, details));
        }
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err.message : "Failed to load.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void load();
    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading)
    return <div className="py-16 text-center text-muted-foreground">Loading dashboard...</div>;
  if (error) return <div className="py-16 text-center text-destructive">{error}</div>;

  const active = applications.filter(
    (a) => !["Rejected", "Ghosted", "Declined", "Rescinded"].includes(a.status),
  );
  const interviewingCount = applications.filter((a) => a.status === "Interviewing").length;
  const readyCount = applications.filter((a) => a.processingStatus === "review_ready").length;
  const matchScores = applications.filter((a) => (a.matchScore ?? 0) > 0);
  const avgMatch =
    matchScores.length > 0
      ? Math.round(matchScores.reduce((s, a) => s + (a.matchScore ?? 0), 0) / matchScores.length)
      : 0;

  const statsCards = [
    { label: "Active applications", value: active.length },
    { label: "Interviewing", value: interviewingCount },
    { label: "Ready to apply", value: readyCount },
    { label: "Avg. match score", value: `${avgMatch}%` },
  ];

  const recentActivity = applications
    .slice()
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
    .slice(0, 5)
    .map((app) => ({
      id: app.id,
      text:
        app.status === "Interviewing"
          ? "Status updated"
          : app.status === "Applied"
            ? "Application submitted"
            : app.status === "Rejected"
              ? "Not selected"
              : app.status === "Ghosted"
                ? "No response"
                : app.status === "Declined"
                  ? "Offer declined"
                  : app.status === "Rescinded"
                    ? "Offer rescinded"
                    : app.matchScore
                      ? "Match analysis completed"
                      : "Job added",
      meta: `${app.company} · ${app.role}`,
      time: app.dateLabel,
      kind: (app.status === "Interviewing"
        ? "interview"
        : app.status === "Applied"
          ? "applied"
          : app.status === "Ghosted"
            ? "ghosted"
            : app.matchScore
              ? "match"
              : "added") as keyof typeof activityIcon,
    }));

  const followUps: CalendarFollowUp[] = applications.flatMap((app) =>
    (app.followUps ?? [])
      .map((followUp) => ({
        id: followUp.id,
        jobApplicationId: app.id,
        title: followUp.title,
        company: app.company,
        scheduledAt: new Date(followUp.scheduledAt),
      }))
      .filter((followUp) => !Number.isNaN(followUp.scheduledAt.getTime())),
  );

  return (
    <div className="space-y-6">
      {profile && (
        <OnboardingChecklist profile={profile} hasApplications={applications.length > 0} />
      )}

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Link2 className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Turn any job posting into a tailored application
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Import from LinkedIn Desktop or paste the role details manually.
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            window.dispatchEvent(new CustomEvent("careerden:open-add-job"));
          }}
          className="shrink-0"
        >
          Add job application
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statsCards.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader
            title="Active applications"
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate("/applications")}>
                View all
                <ArrowRight className="size-3.5" />
              </Button>
            }
          />
          <div className="divide-y divide-border border-t border-border">
            {active.slice(0, 6).map((app) => (
              <button
                key={app.id}
                onClick={() => navigate(`/applications/${app.id}`)}
                className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary text-xs font-semibold text-secondary-foreground">
                  {app.logo ? (
                    <img src={app.logo} alt="" className="size-full object-contain" />
                  ) : (
                    app.company.slice(0, 2)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{app.role}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {app.company} · {app.location}
                  </p>
                </div>
                {(app.matchScore ?? 0) > 0 && (
                  <span
                    className={cn(
                      "hidden text-xs font-medium sm:block",
                      (app.matchScore ?? 0) >= 70
                        ? "text-success"
                        : (app.matchScore ?? 0) >= 50
                          ? "text-warning-emphasis"
                          : "text-destructive",
                    )}
                  >
                    {app.matchScore}% match
                  </span>
                )}
                <StatusBadge status={mapStatus(app)} />
              </button>
            ))}
            {active.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                No active applications yet.
              </div>
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Follow-ups" />
          <FollowUpCalendar
            followUps={followUps}
            onOpen={(jobApplicationId) =>
              navigate(`/applications/${jobApplicationId}?tab=timeline`)
            }
          />
        </Panel>
      </div>
      <Panel>
        <PanelHeader
          title="Application pipeline"
          action={
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="size-3.5 accent-primary"
                checked={showCompanyLogos}
                onChange={(event) => setShowCompanyLogos(event.target.checked)}
              />
              Company logos
            </label>
          }
        />
        <ApplicationPipelineSankey
          data={stats?.sankey ?? { nodes: [], links: [] }}
          showCompanyLogos={showCompanyLogos}
        />
      </Panel>
      <Panel>
        <PanelHeader title="Recent activity" />
        <ul className="border-t border-border">
          {recentActivity.map((item) => {
            const Icon = activityIcon[item.kind] ?? FileCheck2;
            return (
              <li
                key={item.id}
                className="flex items-center gap-3.5 px-5 py-3 not-last:border-b not-last:border-border"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">{item.text}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.meta}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{item.time}</span>
              </li>
            );
          })}
          {recentActivity.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-muted-foreground">
              No recent activity.
            </li>
          )}
        </ul>
      </Panel>
    </div>
  );
}

function mapStatus(app: JobApplication): DisplayStatus {
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
