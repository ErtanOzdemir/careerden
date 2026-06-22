import { aiMatchResultSchema } from "@link2cv/contracts";
import type {
  AiProvider,
  JobApplicationRepository,
  MatchAnalysisResult,
  ScrapeBundle,
  UserProfile,
} from "@link2cv/domain";
import { documentContentFromMatchAnalysis } from "@link2cv/domain";

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
        "Treat scrapedJob.requirements as the canonical extracted job requirements.",
        "Use scrapedJob.description only as supporting context when requirements need clarification.",
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
        requirementGuidance:
          "Use scrapedJob.requirements as the primary basis for missingSkills, strongSkills, recommendedAchievements, and interviewTips.",
        requiredOutput: {
          matchScore: "Integer 0-100",
          missingSkills: "Skills or criteria from the job that are not evident in the profile",
          strongSkills: "Profile skills that strongly match the job",
          recommendedAchievements: "Existing profile achievements to emphasize",
          customizedSummary: "2-3 sentences for the CV summary",
          interviewTips: "Practical tips for this interview",
          coverLetterGuidance: "Optional guidance for the cover letter",
          experienceEnhancements:
            "Optional array keyed by zero-based profile experience index. Include enhancedDescription and enhancedAchievements only when grounded in the original profile experience.",
        },
      }),
      outputSchema: aiMatchResultSchema,
    });

    await this.jobApplications.saveMatchAnalysis(input.jobApplicationId, result);
    await this.jobApplications.saveDocumentContent(
      input.jobApplicationId,
      documentContentFromMatchAnalysis(result),
    );

    return result;
  }
}
