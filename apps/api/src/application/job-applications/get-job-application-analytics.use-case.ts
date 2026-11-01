import type {
  ApplicationStatus,
  FileStorage,
  JobApplication,
  JobApplicationEvent,
  JobApplicationRepository,
  UserProfileAccessRepository,
} from "@careerden/domain";
import { getAccessibleProfile } from "../profiles/profile-access.js";
import { getCompanyLogoUrl } from "./job-application-read-model.js";

// More companies than this never fit on one pipeline ribbon, even at the smallest logo size.
export const analyticsCompaniesPerFlowLimit = 24;

// Source node of every pipeline path.
export const pipelineSource = "applications";

const pipelineStages: ApplicationStatus[] = ["applied", "phone_screen", "interview", "offer"];
const pipelineOutcomes: ApplicationStatus[] = ["rejected", "ghosted", "declined", "rescinded"];
// Statuses that mean an offer was received.
const offerStatuses: ApplicationStatus[] = ["offer", "declined", "rescinded"];

export interface AnalyticsCompany {
  jobApplicationId: string;
  companyName?: string;
  companyLogoUrl?: string;
}

export interface AnalyticsPipelineFlow {
  source: typeof pipelineSource | ApplicationStatus;
  target: ApplicationStatus;
  count: number;
  // Most recently updated companies whose path currently ends with this flow.
  companies: AnalyticsCompany[];
}

export interface JobApplicationAnalytics {
  total: number;
  byStatus: Record<string, number>;
  responseRate: number;
  interviewConversionRate: number;
  offers: number;
  rejections: number;
  applicationsOverTime: Record<string, number>;
  averageTimeToResponseDays: number | null;
  // Stage-to-stage movement of every application, for the dashboard pipeline.
  pipeline: AnalyticsPipelineFlow[];
}

export class GetJobApplicationAnalyticsUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccessRepository,
    private readonly storage?: FileStorage,
  ) {}

  async execute(profileId: string, userId: string): Promise<JobApplicationAnalytics> {
    await getAccessibleProfile(this.profiles, profileId, userId);
    const applications = await this.jobApplications.listByProfileId(profileId);
    return {
      ...calculateJobApplicationAnalytics(applications.items),
      pipeline: await this.pipeline(applications.items),
    };
  }

  private async pipeline(jobs: JobApplication[]): Promise<AnalyticsPipelineFlow[]> {
    const statusChanges = await this.jobApplications.listStatusChanges(jobs.map((job) => job.id));

    return Promise.all(
      calculatePipelineFlows(jobs, statusChanges).map(async ({ jobs: flowJobs, ...flow }) => ({
        ...flow,
        companies: await Promise.all(
          flowJobs.slice(0, analyticsCompaniesPerFlowLimit).map(async (job) => {
            const companyLogoUrl = this.storage
              ? await getCompanyLogoUrl(this.jobApplications, this.storage, job.id)
              : undefined;
            return {
              jobApplicationId: job.id,
              ...(job.tracking.companyName ? { companyName: job.tracking.companyName } : {}),
              ...(companyLogoUrl ? { companyLogoUrl } : {}),
            };
          }),
        ),
      })),
    );
  }
}

// The stages an application has reached, in pipeline order. Every stage in its status history
// counts, since a status set by mistake is undone and leaves the history. Any status past "saved"
// means the application was sent, an offer can still end in rejection, a declined or rescinded
// offer implies the offer stage, and an outcome is only shown while it is the current status.
export function applicationPipelinePath(
  currentStatus: ApplicationStatus,
  history: ApplicationStatus[],
): ApplicationStatus[] {
  const reached = new Set([...history, currentStatus]);
  const path = pipelineStages.filter((stage) => reached.has(stage));

  const isOutcome = pipelineOutcomes.includes(currentStatus);
  if (path.length === 0 && !isOutcome) return ["saved"];
  if (path[0] !== "applied") path.unshift("applied");
  if (offerStatuses.includes(currentStatus) && path.at(-1) !== "offer") path.push("offer");
  if (isOutcome) path.push(currentStatus);
  return path;
}

export function calculatePipelineFlows(
  jobs: JobApplication[],
  statusChanges: JobApplicationEvent[],
): Array<Omit<AnalyticsPipelineFlow, "companies"> & { jobs: JobApplication[] }> {
  const history = new Map<string, ApplicationStatus[]>();
  for (const event of statusChanges) {
    const statuses = history.get(event.jobApplicationId) ?? [];
    for (const status of [event.metadata.from, event.metadata.to]) {
      if (typeof status === "string") statuses.push(status as ApplicationStatus);
    }
    history.set(event.jobApplicationId, statuses);
  }

  const flows = new Map<
    string,
    Omit<AnalyticsPipelineFlow, "companies"> & { jobs: JobApplication[] }
  >();
  for (const job of [...jobs].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())) {
    const path = applicationPipelinePath(job.tracking.applicationStatus, history.get(job.id) ?? []);
    let source: AnalyticsPipelineFlow["source"] = pipelineSource;
    for (const target of path) {
      const key = `${source}>${target}`;
      const flow = flows.get(key) ?? { source, target, count: 0, jobs: [] };
      flow.count += 1;
      if (target === path.at(-1)) flow.jobs.push(job);
      flows.set(key, flow);
      source = target;
    }
  }
  return [...flows.values()];
}

export function calculateJobApplicationAnalytics(
  jobs: JobApplication[],
): Omit<JobApplicationAnalytics, "pipeline"> {
  const total = jobs.length;
  const byStatus = jobs.reduce<Record<string, number>>((current, job) => {
    current[job.tracking.applicationStatus] = (current[job.tracking.applicationStatus] ?? 0) + 1;
    return current;
  }, {});
  const interviews = jobs.filter((job) =>
    ["phone_screen", "interview", ...offerStatuses].includes(job.tracking.applicationStatus),
  ).length;
  const offers = offerStatuses.reduce((sum, status) => sum + (byStatus[status] ?? 0), 0);
  const rejections = byStatus.rejected ?? 0;
  const responses = interviews + rejections;
  const applicationsOverTime = jobs.reduce<Record<string, number>>((current, job) => {
    const key = job.tracking.dateApplied ?? job.createdAt.toISOString().slice(0, 10);
    current[key] = (current[key] ?? 0) + 1;
    return current;
  }, {});
  const responseDurations = jobs
    .filter((job) => job.tracking.lastResponseAt)
    .map((job) => {
      const start = new Date(job.tracking.dateApplied ?? job.createdAt).getTime();
      const end = job.tracking.lastResponseAt?.getTime() ?? start;
      return Math.max(0, Math.round((end - start) / 86_400_000));
    });

  return {
    total,
    byStatus,
    responseRate: total === 0 ? 0 : responses / total,
    interviewConversionRate: total === 0 ? 0 : interviews / total,
    offers,
    rejections,
    applicationsOverTime,
    averageTimeToResponseDays:
      responseDurations.length === 0
        ? null
        : responseDurations.reduce((sum, days) => sum + days, 0) / responseDurations.length,
  };
}
