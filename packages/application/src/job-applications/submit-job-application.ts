import type {
  CreateJobApplicationInput,
  JobApplication,
  JobApplicationRepository,
  ScrapeBundle,
  UserProfileRepository,
} from "@link2cv/domain";

export class SubmitJobApplicationUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileRepository,
  ) {}

  async execute(input: CreateJobApplicationInput): Promise<JobApplication> {
    const profile = await this.profiles.findById(input.profileId);

    if (!profile) {
      throw new Error(`Profile ${input.profileId} was not found`);
    }

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
