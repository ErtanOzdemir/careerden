import type {
  JobApplicationQueuePayload,
  JobApplicationRepository,
  UserProfileRepository,
} from "@link2cv/domain";
import type { RunMatchAnalysisUseCase } from "../matching/run-match-analysis.use-case.js";

export class AnalyzeScrapedJobUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileRepository,
    private readonly matching: RunMatchAnalysisUseCase,
  ) {}

  async execute(payload: JobApplicationQueuePayload): Promise<void> {
    const jobApplication = await this.jobApplications.findById(payload.jobApplicationId);

    if (!jobApplication) {
      throw new Error(`Job application ${payload.jobApplicationId} was not found`);
    }

    try {
      const profile = await this.profiles.findById(jobApplication.profileId);

      if (!profile) {
        throw new Error(`Profile ${jobApplication.profileId} was not found`);
      }

      const scrape = await this.jobApplications.getScrapeBundle(jobApplication.id);

      if (!scrape) {
        throw new Error(`No desktop scrape bundle found for job application ${jobApplication.id}`);
      }

      await this.jobApplications.addEvent({
        jobApplicationId: jobApplication.id,
        type: "processing",
        title: "AI analysis started",
      });
      await this.jobApplications.updateStatus(jobApplication.id, "analyzing");

      const analysis = await this.matching.execute({
        jobApplicationId: jobApplication.id,
        profile,
        scrape,
      });

      await this.jobApplications.addEvent({
        jobApplicationId: jobApplication.id,
        type: "processing",
        title: "AI analysis completed",
        metadata: { matchScore: analysis.matchScore },
      });
      await this.jobApplications.updateStatus(jobApplication.id, "review_ready");
      await this.jobApplications.addEvent({
        jobApplicationId: jobApplication.id,
        type: "processing",
        title: "Ready for AI match review",
        metadata: { matchScore: analysis.matchScore },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown AI analysis error";
      await this.jobApplications.updateStatus(jobApplication.id, "failed", message);
      await this.jobApplications.addEvent({
        jobApplicationId: jobApplication.id,
        type: "processing",
        title: "AI analysis failed",
        body: message,
      });
      throw error;
    }
  }
}
