import type {
  JobApplication,
  JobApplicationRepository,
  UserProfileAccessRepository,
} from "@link2cv/domain";
import { getAccessibleProfile } from "../profiles/profile-access.js";

export interface JobApplicationAnalytics {
  total: number;
  byStatus: Record<string, number>;
  responseRate: number;
  interviewConversionRate: number;
  offers: number;
  rejections: number;
  applicationsOverTime: Record<string, number>;
  averageTimeToResponseDays: number | null;
}

export class GetJobApplicationAnalyticsUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccessRepository,
  ) {}

  async execute(profileId: string, userId: string): Promise<JobApplicationAnalytics> {
    await getAccessibleProfile(this.profiles, profileId, userId);
    const applications = await this.jobApplications.listByProfileId(profileId);
    return calculateJobApplicationAnalytics(applications.items);
  }
}

export function calculateJobApplicationAnalytics(jobs: JobApplication[]): JobApplicationAnalytics {
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
