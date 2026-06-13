import type {
  AiMatchingProvider,
  JobApplicationRepository,
  MatchAnalysisResult,
  ScrapeBundle,
  UserProfile
} from "@link2cv/domain";

export class RunMatchAnalysisUseCase {
  constructor(
    private readonly aiProvider: AiMatchingProvider,
    private readonly jobApplications: JobApplicationRepository
  ) {}

  async execute(input: {
    jobApplicationId: string;
    profile: UserProfile;
    scrape: ScrapeBundle;
  }): Promise<MatchAnalysisResult> {
    const result = await this.aiProvider.analyze({
      profile: input.profile,
      scrape: input.scrape
    });

    await this.jobApplications.saveMatchAnalysis(input.jobApplicationId, result);

    return result;
  }
}
