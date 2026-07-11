import type {
  JobApplicationQueuePayload,
  JobApplicationRepository,
  PersistenceUnitOfWork,
  UserProfileRepository,
} from "@link2cv/domain";
import { documentContentFromMatchAnalysis } from "@link2cv/domain";
import type { RunMatchAnalysisUseCase } from "../matching/run-match-analysis.use-case.js";
import { enqueueJobApplicationChange } from "./enqueue-job-application-change.js";

export class AnalyzeScrapedJobUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileRepository,
    private readonly matching: RunMatchAnalysisUseCase,
    private readonly unitOfWork: PersistenceUnitOfWork,
  ) {}

  async execute(payload: JobApplicationQueuePayload): Promise<void> {
    const jobApplication = await this.jobApplications.findById(payload.jobApplicationId);

    if (!jobApplication) {
      throw new Error(`Job application ${payload.jobApplicationId} was not found`);
    }
    const attemptId = payload.analysisAttemptId ?? payload.jobApplicationId;
    const started = await this.unitOfWork.execute(
      async ({ jobApplications, outbox }): Promise<boolean> => {
        if (!(await jobApplications.beginAnalysis(jobApplication.id, attemptId))) return false;
        await jobApplications.addEvent({
          jobApplicationId: jobApplication.id,
          type: "processing",
          title: "AI analysis started",
          metadata: { attemptId },
        });
        await enqueueJobApplicationChange(outbox, jobApplication.id, jobApplication.profileId);
        return true;
      },
    );
    if (!started) return;

    try {
      const profile = await this.profiles.findById(jobApplication.profileId);

      if (!profile) {
        throw new Error(`Profile ${jobApplication.profileId} was not found`);
      }

      const scrape = await this.jobApplications.getScrapeBundle(jobApplication.id);

      if (!scrape) {
        throw new Error(`No desktop scrape bundle found for job application ${jobApplication.id}`);
      }

      const analysis = await this.matching.execute({
        jobApplicationId: jobApplication.id,
        profile,
        scrape,
      });

      await this.unitOfWork.execute(async ({ jobApplications, outbox }) => {
        const completed = await jobApplications.completeAnalysis(
          jobApplication.id,
          attemptId,
          analysis,
          documentContentFromMatchAnalysis(analysis),
        );
        if (!completed) return;
        await jobApplications.addEvent({
          jobApplicationId: jobApplication.id,
          type: "processing",
          title: "AI analysis completed",
          metadata: { matchScore: analysis.matchScore, attemptId },
        });
        await jobApplications.addEvent({
          jobApplicationId: jobApplication.id,
          type: "processing",
          title: "Ready for AI match review",
          metadata: { matchScore: analysis.matchScore, attemptId },
        });
        await enqueueJobApplicationChange(outbox, jobApplication.id, jobApplication.profileId);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown AI analysis error";
      await this.unitOfWork.execute(async ({ jobApplications, outbox }) => {
        if (!(await jobApplications.failAnalysis(jobApplication.id, attemptId, message))) return;
        await jobApplications.addEvent({
          jobApplicationId: jobApplication.id,
          type: "processing",
          title: "AI analysis failed",
          body: message,
          metadata: { attemptId },
        });
        await enqueueJobApplicationChange(outbox, jobApplication.id, jobApplication.profileId);
      });
      throw error;
    }
  }
}
