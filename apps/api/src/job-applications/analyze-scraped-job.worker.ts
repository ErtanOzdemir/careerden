import { Worker } from "bullmq";
import type { Worker as BullMqWorker } from "bullmq";
import {
  type JobApplicationQueuePayload,
  type JobApplicationRepository,
  type UserProfileRepository,
} from "@link2cv/domain";
import { RunMatchAnalysisUseCase } from "@link2cv/application";
import type { AiProviderFactory } from "@link2cv/infrastructure";
import { jobApplicationQueueName } from "@link2cv/infrastructure";

export function createAnalyzeScrapedJobWorker(input: {
  aiProviderFactory: AiProviderFactory;
  jobApplications: JobApplicationRepository;
  profiles: UserProfileRepository;
  redisUrl: string;
}): BullMqWorker<JobApplicationQueuePayload> {
  const matching = new RunMatchAnalysisUseCase(
    input.aiProviderFactory.create(),
    input.jobApplications,
  );

  return new Worker<JobApplicationQueuePayload>(
    jobApplicationQueueName,
    async (job) => {
      const jobApplication = await input.jobApplications.findById(job.data.jobApplicationId);

      if (!jobApplication) {
        throw new Error(`Job application ${job.data.jobApplicationId} was not found`);
      }

      try {
        const profile = await input.profiles.findById(jobApplication.profileId);

        if (!profile) {
          throw new Error(`Profile ${jobApplication.profileId} was not found`);
        }

        const scrape = await input.jobApplications.getScrapeBundle(jobApplication.id);

        if (!scrape) {
          throw new Error(
            `No desktop scrape bundle found for job application ${jobApplication.id}`,
          );
        }

        await input.jobApplications.updateStatus(jobApplication.id, "scraping");
        await input.jobApplications.addEvent({
          jobApplicationId: jobApplication.id,
          type: "processing",
          title: "Desktop scrape saved",
          metadata: {
            companyName: scrape.job.companyName,
            roleTitle: scrape.job.title,
          },
        });
        await input.jobApplications.updateStatus(jobApplication.id, "analyzing");
        await input.jobApplications.addEvent({
          jobApplicationId: jobApplication.id,
          type: "processing",
          title: "AI analysis started",
        });

        const analysis = await matching.execute({
          jobApplicationId: jobApplication.id,
          profile,
          scrape,
        });

        await input.jobApplications.addEvent({
          jobApplicationId: jobApplication.id,
          type: "processing",
          title: "AI analysis completed",
          metadata: { matchScore: analysis.matchScore },
        });
        await input.jobApplications.updateStatus(jobApplication.id, "review_ready");
        await input.jobApplications.addEvent({
          jobApplicationId: jobApplication.id,
          type: "processing",
          title: "Ready for AI match review",
          metadata: { matchScore: analysis.matchScore },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown AI analysis error";
        await input.jobApplications.updateStatus(jobApplication.id, "failed", message);
        await input.jobApplications.addEvent({
          jobApplicationId: jobApplication.id,
          type: "processing",
          title: "AI analysis failed",
          body: message,
        });
        throw error;
      }
    },
    {
      connection: { url: input.redisUrl },
    },
  );
}
