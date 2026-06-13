import { aiMatchResultSchema } from "@link2cv/contracts";
import type { MatchAnalysisInput, MatchAnalysisResult } from "@link2cv/domain";
import { generateText, Output } from "ai";
import type { LanguageModel } from "ai";

export async function runAiSdkMatchAnalysis(
  model: LanguageModel,
  input: MatchAnalysisInput
): Promise<MatchAnalysisResult> {
  const { output } = await generateText({
    model,
    output: Output.object({
      name: "MatchAnalysisResult",
      description: "Criteria matching result for a user's profile against a scraped job posting.",
      schema: aiMatchResultSchema
    }),
    system: [
      "You are an expert career matching assistant.",
      "Compare the scraped job details with the user's saved career profile.",
      "Return concise, factual, profile-grounded recommendations.",
      "Do not invent experience, employers, credentials, or skills that are not present in the profile."
    ].join(" "),
    prompt: JSON.stringify({
      userProfile: input.profile,
      scrapedJob: input.scrape.job,
      scrapedCompany: {
        linkedIn: input.scrape.companyLinkedIn,
        website: input.scrape.companyWebsite,
        careerPage: input.scrape.careerPage
      },
      requiredOutput: {
        matchScore: "Integer 0-100",
        missingSkills: "Skills or criteria from the job that are not evident in the profile",
        strongSkills: "Profile skills that strongly match the job",
        recommendedAchievements: "Existing profile achievements to emphasize",
        customizedSummary: "2-3 sentences for the CV summary",
        interviewTips: "Practical tips for this interview",
        coverLetterGuidance: "Optional guidance for the cover letter"
      }
    })
  });

  return aiMatchResultSchema.parse(output);
}
