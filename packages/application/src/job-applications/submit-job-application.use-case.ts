import type {
  CreateJobApplicationInput,
  JobApplication,
  JobApplicationRepository,
  ScrapeBundle,
  UserProfileAccessRepository,
} from "@link2cv/domain";
import { getAccessibleProfile } from "../profiles/profile-access.js";

export class SubmitJobApplicationUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccessRepository,
  ) {}

  async execute(input: CreateJobApplicationInput, userId: string): Promise<JobApplication> {
    await getAccessibleProfile(this.profiles, input.profileId, userId);

    const jobApplication = await this.jobApplications.create(input);

    if (!input.sourceUrl) {
      await this.jobApplications.saveScrapeBundle(
        jobApplication.id,
        createManualScrapeBundle(input),
      );
      await this.jobApplications.updateStatus(jobApplication.id, "scraped");
      await this.jobApplications.addEvent({
        jobApplicationId: jobApplication.id,
        type: "processing",
        title: "Manual job details saved",
        metadata: { strategy: "manual" },
      });

      return {
        ...jobApplication,
        status: "scraped",
      };
    }

    return jobApplication;
  }
}

function createManualScrapeBundle(input: CreateJobApplicationInput): ScrapeBundle {
  const title = input.roleTitle ?? "Untitled role";
  const companyName = input.companyName ?? "Unknown company";

  return {
    job: {
      title,
      companyName,
      ...(input.roleType ? { location: input.roleType } : {}),
      description: `Manual job entry for ${title} at ${companyName}.`,
      requirements: [],
      raw: {
        adapter: "manual-job",
        strategy: "manual",
        source: "user-created-job-application",
        jobUrl: input.jobUrl,
        metadata: input.metadata ?? {},
        scrapedAt: new Date().toISOString(),
      },
    },
  };
}
