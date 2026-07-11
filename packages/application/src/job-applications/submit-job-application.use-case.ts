import type {
  CreateJobApplicationInput,
  JobApplication,
  PersistenceUnitOfWork,
  ScrapeBundle,
} from "@link2cv/domain";
import { getAccessibleProfile } from "../profiles/profile-access.js";
import { enqueueJobApplicationChange } from "./enqueue-job-application-change.js";

export class SubmitJobApplicationUseCase {
  constructor(private readonly unitOfWork: PersistenceUnitOfWork) {}

  async execute(input: CreateJobApplicationInput, userId: string): Promise<JobApplication> {
    return this.unitOfWork.execute(async ({ jobApplications, outbox, profiles }) => {
      await getAccessibleProfile(profiles, input.profileId, userId);

      const jobApplication = await jobApplications.create(input);

      if (!input.sourceUrl) {
        await jobApplications.saveScrapeBundle(jobApplication.id, createManualScrapeBundle(input));
        await jobApplications.updateStatus(jobApplication.id, "scraped");
        await jobApplications.addEvent({
          jobApplicationId: jobApplication.id,
          type: "processing",
          title: "Manual job details saved",
          metadata: { strategy: "manual" },
        });
      }

      await enqueueJobApplicationChange(outbox, jobApplication.id, jobApplication.profileId);

      return {
        ...jobApplication,
        ...(!input.sourceUrl ? { status: "scraped" as const } : {}),
      };
    });
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
