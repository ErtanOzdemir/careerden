import type {
  DocumentRenderer,
  FileStorage,
  GeneratedDocument,
  JobApplicationRepository,
  MatchAnalysisResult,
  TemplateRenderer,
  UserProfile
} from "@link2cv/domain";

export class GenerateDocumentsUseCase {
  constructor(
    private readonly templates: TemplateRenderer,
    private readonly documents: DocumentRenderer,
    private readonly storage: FileStorage,
    private readonly jobApplications: JobApplicationRepository
  ) {}

  async execute(input: {
    jobApplicationId: string;
    profile: UserProfile;
    analysis: MatchAnalysisResult;
  }): Promise<GeneratedDocument[]> {
    const data = toTemplateData(input.profile, input.analysis);
    const generated: GeneratedDocument[] = [];

    for (const template of [
      { id: "cv.default", kind: "cv" as const, fileName: "cv.pdf" },
      { id: "cover-letter.default", kind: "cover_letter" as const, fileName: "cover-letter.pdf" }
    ]) {
      const html = await this.templates.render(template.id, data);
      const pdf = await this.documents.htmlToPdf(html.toString());
      const stored = await this.storage.put({
        fileName: template.fileName,
        contentType: "application/pdf",
        body: pdf,
        metadata: {
          jobApplicationId: input.jobApplicationId,
          kind: template.kind
        }
      });

      generated.push(
        await this.jobApplications.attachGeneratedDocument({
          jobApplicationId: input.jobApplicationId,
          kind: template.kind,
          fileId: stored.id,
          fileName: template.fileName,
          contentType: "application/pdf"
        })
      );
    }

    return generated;
  }
}

function toTemplateData(profile: UserProfile, analysis: MatchAnalysisResult): Record<string, unknown> {
  return {
    full_name: profile.fullName,
    email: profile.email,
    headline: profile.headline ?? "",
    location: profile.location ?? "",
    summary: profile.summary ?? "",
    skills: profile.skills,
    experience_list: profile.experience,
    match_score: analysis.matchScore,
    missing_skills: analysis.missingSkills,
    strong_skills: analysis.strongSkills,
    recommended_achievements: analysis.recommendedAchievements,
    customized_summary: analysis.customizedSummary,
    interview_tips: analysis.interviewTips,
    cover_letter_guidance: analysis.coverLetterGuidance ?? []
  };
}
