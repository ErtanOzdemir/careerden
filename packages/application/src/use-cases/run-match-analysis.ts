import { aiMatchResultSchema } from "@link2cv/contracts";
import type {
  AiProvider,
  JobApplicationRepository,
  MatchAnalysisResult,
  ScrapeBundle,
  UserProfile,
} from "@link2cv/domain";

export class RunMatchAnalysisUseCase {
  constructor(
    private readonly aiProvider: AiProvider,
    private readonly jobApplications: JobApplicationRepository,
  ) {}

  async execute(input: {
    jobApplicationId: string;
    profile: UserProfile;
    scrape: ScrapeBundle;
  }): Promise<MatchAnalysisResult> {
    const result = await this.aiProvider.generate({
      system: [
        "You are an expert career matching assistant.",
        "Compare the scraped job details with the user's saved career profile.",
        "Return concise, factual, profile-grounded recommendations.",
        "Do not invent experience, employers, credentials, or skills that are not present in the profile.",
      ].join(" "),
      prompt: JSON.stringify({
        userProfile: input.profile,
        scrapedJob: input.scrape.job,
        scrapedCompany: {
          linkedIn: input.scrape.companyLinkedIn,
          website: input.scrape.companyWebsite,
          careerPage: input.scrape.careerPage,
        },
        requiredOutput: {
          matchScore: "Integer 0-100",
          missingSkills: "Skills or criteria from the job that are not evident in the profile",
          strongSkills: "Profile skills that strongly match the job",
          recommendedAchievements: "Existing profile achievements to emphasize",
          customizedSummary: "2-3 sentences for the CV summary",
          interviewTips: "Practical tips for this interview",
          coverLetterGuidance: "Optional guidance for the cover letter",
        },
      }),
      outputSchema: aiMatchResultSchema,
    });

    await this.jobApplications.saveMatchAnalysis(input.jobApplicationId, result);

    return result;
  }
}
