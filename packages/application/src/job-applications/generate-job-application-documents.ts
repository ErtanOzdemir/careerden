import type {
  GeneratedDocument,
  JobApplicationRepository,
  UserProfileRepository,
} from "@link2cv/domain";
import { canTransitionJobApplicationStatus } from "@link2cv/domain";
import type { GenerateDocumentsUseCase } from "../documents/generate-documents.js";

export class GenerateJobApplicationDocumentsUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileRepository,
    private readonly documentGeneration: GenerateDocumentsUseCase,
  ) {}

  async execute(jobApplicationId: string): Promise<GeneratedDocument[]> {
    const jobApplication = await this.jobApplications.findById(jobApplicationId);

    if (!jobApplication) {
      throw new Error(`Job application ${jobApplicationId} was not found`);
    }

    const profile = await this.profiles.findById(jobApplication.profileId);

    if (!profile) {
      throw new Error(`Profile ${jobApplication.profileId} was not found`);
    }

    const analysis = await this.jobApplications.getMatchAnalysis(jobApplicationId);

    if (!analysis) {
      throw new Error(`Job application ${jobApplicationId} does not have AI analysis to approve`);
    }

    if (!canTransitionJobApplicationStatus(jobApplication.status, "generating_documents")) {
      throw new Error(
        `Invalid job application status transition: ${jobApplication.status} -> generating_documents`,
      );
    }

    try {
      await this.jobApplications.updateStatus(jobApplicationId, "generating_documents");
      await this.jobApplications.addEvent({
        jobApplicationId,
        type: "processing",
        title: "Document generation approved",
      });

      const generated = await this.documentGeneration.execute({
        jobApplicationId,
        jobApplication,
        profile,
        analysis,
      });

      await this.jobApplications.updateStatus(jobApplicationId, "completed");
      await this.jobApplications.addEvent({
        jobApplicationId,
        type: "processing",
        title: "Document generation completed",
      });

      return generated;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown document generation error";
      await this.jobApplications.updateStatus(jobApplicationId, "failed", message);
      await this.jobApplications.addEvent({
        jobApplicationId,
        type: "processing",
        title: "Document generation failed",
        body: message,
      });
      throw error;
    }
  }
}
