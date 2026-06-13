import { aiMatchResultSchema } from "@link2cv/contracts";
import type { AiMatchingProvider, MatchAnalysisInput, MatchAnalysisResult } from "@link2cv/domain";

export class LocalHeuristicMatchingProvider implements AiMatchingProvider {
  async analyze(input: MatchAnalysisInput): Promise<MatchAnalysisResult> {
    const requirements = input.scrape.job.requirements.map((item) => item.toLowerCase());
    const profileSkills = input.profile.skills.map((skill) => skill.toLowerCase());
    const strongSkills = input.profile.skills.filter((skill) =>
      requirements.some((requirement) => requirement.includes(skill.toLowerCase()))
    );
    const missingSkills = input.scrape.job.requirements.filter(
      (requirement) => !profileSkills.some((skill) => requirement.toLowerCase().includes(skill))
    );
    const matchScore =
      input.scrape.job.requirements.length === 0
        ? 50
        : Math.round((strongSkills.length / input.scrape.job.requirements.length) * 100);

    return aiMatchResultSchema.parse({
      matchScore,
      missingSkills,
      strongSkills,
      recommendedAchievements: input.profile.experience.flatMap((item) => item.achievements).slice(0, 5),
      customizedSummary: `${input.profile.fullName} has relevant experience for ${input.scrape.job.title}. Highlight the strongest matching skills and measurable achievements for this role.`,
      interviewTips: [
        "Prepare examples that connect your past achievements to the listed requirements.",
        "Be ready to discuss any missing skills and how you would close the gap."
      ],
      coverLetterGuidance: [
        "Open with the job title and the strongest match from your background.",
        "Keep the letter focused on evidence from your profile."
      ]
    });
  }
}
