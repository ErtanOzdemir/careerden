import type {
  DocumentPreferences,
  GeneratedDocument,
  JobApplicationRepository,
  PremiumAiService,
  UserProfileRepository,
} from "@link2cv/domain";
import { canTransitionJobApplicationStatus } from "@link2cv/domain";
import { GenerateDocumentsUseCase } from "../documents/generate-documents.js";

export class GenerateDocumentsWithAiUseCase {
  constructor(
    private readonly premiumAi: PremiumAiService,
    private readonly generateDocuments: GenerateDocumentsUseCase,
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileRepository,
  ) {}

  async execute(input: {
    jobApplicationId: string;
    preferences: DocumentPreferences;
  }): Promise<GeneratedDocument[]> {
    const jobApplication = await this.jobApplications.findById(input.jobApplicationId);

    if (!jobApplication) {
      throw new Error(`Job application ${input.jobApplicationId} was not found`);
    }

    const profile = await this.profiles.findById(jobApplication.profileId);

    if (!profile) {
      throw new Error(`Profile ${jobApplication.profileId} was not found`);
    }

    const scrape = await this.jobApplications.getScrapeBundle(input.jobApplicationId);

    if (!scrape) {
      throw new Error(`No scrape bundle found for job application ${input.jobApplicationId}`);
    }

    await this.transition(input.jobApplicationId, jobApplication.status, "generating_documents");
    await this.jobApplications.addEvent({
      jobApplicationId: input.jobApplicationId,
      type: "processing",
      title: "AI document generation started",
    });

    const result = await this.premiumAi.generate({
      scrape,
      profile,
      preferences: input.preferences,
    });

    await this.jobApplications.saveMatchAnalysis(input.jobApplicationId, result.matchAnalysis);
    await this.jobApplications.saveDocumentContent(input.jobApplicationId, result.documentContent);
    await this.jobApplications.addEvent({
      jobApplicationId: input.jobApplicationId,
      type: "processing",
      title: "AI document generation completed",
      metadata: {
        matchScore: result.matchAnalysis.matchScore,
        creditsRemaining: result.creditsRemaining,
      },
    });

    const documents = await this.generateDocuments.execute({
      jobApplicationId: input.jobApplicationId,
      jobApplication,
      profile,
      analysis: result.matchAnalysis,
      documentContent: result.documentContent,
    });

    await this.transition(input.jobApplicationId, "generating_documents", "completed");
    await this.jobApplications.addEvent({
      jobApplicationId: input.jobApplicationId,
      type: "processing",
      title: "Documents generated",
    });

    return documents;
  }

  private async transition(
    jobApplicationId: string,
    from: Parameters<typeof canTransitionJobApplicationStatus>[0],
    to: Parameters<typeof canTransitionJobApplicationStatus>[1],
  ): Promise<void> {
    if (!canTransitionJobApplicationStatus(from, to)) {
      throw new Error(`Invalid job application status transition: ${from} -> ${to}`);
    }

    await this.jobApplications.updateStatus(jobApplicationId, to);
  }
}
