import type {
  FileStorage,
  JobApplication,
  JobApplicationRepository,
  UserProfileAccessRepository,
} from "@careerden/domain";
import { getAccessibleProfile } from "../profiles/profile-access.js";
import { getCompanyLogoUrl } from "./job-application-read-model.js";

// More companies than this never fit on one pipeline ribbon, even at the smallest logo size.
export const analyticsCompaniesPerStatusLimit = 24;

export interface AnalyticsCompany {
  jobApplicationId: string;
  companyName?: string;
  companyLogoUrl?: string;
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
  // Most recently updated companies per application status, for the dashboard pipeline.
  companiesByStatus: Record<string, AnalyticsCompany[]>;
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
      companiesByStatus: await this.companiesByStatus(applications.items),
    };
  }

  private async companiesByStatus(
    jobs: JobApplication[],
  ): Promise<Record<string, AnalyticsCompany[]>> {
    const grouped = new Map<string, JobApplication[]>();
    for (const job of [...jobs].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())) {
      const status = job.tracking.applicationStatus;
      const group = grouped.get(status) ?? [];
      if (group.length < analyticsCompaniesPerStatusLimit) group.push(job);
      grouped.set(status, group);
    }

    const entries = await Promise.all(
      [...grouped].map(async ([status, group]) => {
        const companies = await Promise.all(
          group.map(async (job): Promise<AnalyticsCompany> => {
            const companyLogoUrl = this.storage
              ? await getCompanyLogoUrl(this.jobApplications, this.storage, job.id)
              : undefined;
            return {
              jobApplicationId: job.id,
              ...(job.tracking.companyName ? { companyName: job.tracking.companyName } : {}),
              ...(companyLogoUrl ? { companyLogoUrl } : {}),
            };
          }),
        );
        return [status, companies] as const;
      }),
    );
    return Object.fromEntries(entries);
  }
}

export function calculateJobApplicationAnalytics(
  jobs: JobApplication[],
): Omit<JobApplicationAnalytics, "companiesByStatus"> {
  const total = jobs.length;
  const byStatus = jobs.reduce<Record<string, number>>((current, job) => {
    current[job.tracking.applicationStatus] = (current[job.tracking.applicationStatus] ?? 0) + 1;
    return current;
  }, {});
  const interviews = jobs.filter((job) =>
    ["phone_screen", "interview", "offer"].includes(job.tracking.applicationStatus),
  ).length;
  const offers = byStatus.offer ?? 0;
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
