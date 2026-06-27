import type {
  DocumentRenderer,
  DocumentContent,
  DocxTemplateRenderer,
  FileStorage,
  GeneratedDocument,
  JobApplicationRepository,
  JobApplication,
  MatchAnalysisResult,
  ProfileEducation,
  ProfileExperience,
  ScrapeBundle,
  TemplateRenderer,
  UserProfile,
  UserProfileRepository,
} from "@link2cv/domain";
import { documentContentFromMatchAnalysis } from "@link2cv/domain";

export class GenerateDocumentsUseCase {
  constructor(
    private readonly templates: TemplateRenderer,
    private readonly documents: DocumentRenderer,
    private readonly storage: FileStorage,
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileRepository,
    private readonly docxTemplates?: DocxTemplateRenderer,
  ) {}

  async execute(input: {
    jobApplicationId: string;
    jobApplication: JobApplication;
    profile: UserProfile;
    analysis: MatchAnalysisResult;
    documentContent?: DocumentContent;
  }): Promise<GeneratedDocument[]> {
    const scrape = await this.jobApplications.getScrapeBundle(input.jobApplicationId);
    const documentContent =
      input.documentContent ?? documentContentFromMatchAnalysis(input.analysis);
    const data = toTemplateData(
      input.profile,
      input.analysis,
      documentContent,
      input.jobApplication,
      scrape,
    );
    const generated: GeneratedDocument[] = [];
    const cvTemplate = await this.profiles.findDefaultDocumentTemplate(input.profile.id, "cv");

    if (cvTemplate) {
      if (!this.docxTemplates) {
        throw new Error("DOCX template rendering is not configured");
      }

      const templateFile = await this.storage.get(cvTemplate.fileId);
      const docx = await this.docxTemplates.render({
        template: cvTemplate,
        templateBody: templateFile.body,
        data,
      });
      generated.push(
        await this.storeGeneratedDocument({
          jobApplicationId: input.jobApplicationId,
          kind: "cv",
          format: "docx",
          fileName: "cv.docx",
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          body: docx,
        }),
      );
    } else {
      generated.push(
        await this.renderHtmlPdf({
          jobApplicationId: input.jobApplicationId,
          templateId: "cv.default",
          kind: "cv",
          fileName: "cv.pdf",
          data,
        }),
      );
    }

    generated.push(
      await this.renderHtmlPdf({
        jobApplicationId: input.jobApplicationId,
        templateId: "cover-letter.default",
        kind: "cover_letter",
        fileName: "cover-letter.pdf",
        data,
      }),
    );

    return generated;
  }

  private async renderHtmlPdf(input: {
    jobApplicationId: string;
    templateId: string;
    kind: "cover_letter" | "cv";
    fileName: string;
    data: Record<string, unknown>;
  }): Promise<GeneratedDocument> {
    const html = await this.templates.render(input.templateId, input.data);
    const pdf = await this.documents.htmlToPdf(html.toString());

    return this.storeGeneratedDocument({
      jobApplicationId: input.jobApplicationId,
      kind: input.kind,
      format: "pdf",
      fileName: input.fileName,
      contentType: "application/pdf",
      body: pdf,
    });
  }

  private async storeGeneratedDocument(input: {
    jobApplicationId: string;
    kind: "cover_letter" | "cv";
    format: "docx" | "pdf";
    fileName: string;
    contentType: string;
    body: Buffer;
  }): Promise<GeneratedDocument> {
    const stored = await this.storage.put({
      fileName: input.fileName,
      contentType: input.contentType,
      body: input.body,
      metadata: {
        jobApplicationId: input.jobApplicationId,
        kind: input.kind,
        format: input.format,
      },
    });

    return this.jobApplications.attachGeneratedDocument({
      jobApplicationId: input.jobApplicationId,
      kind: input.kind,
      format: input.format,
      fileId: stored.id,
      fileName: input.fileName,
      contentType: input.contentType,
    });
  }
}

function toTemplateData(
  profile: UserProfile,
  analysis: MatchAnalysisResult,
  documentContent: DocumentContent,
  jobApplication: JobApplication,
  scrape: ScrapeBundle | null,
): Record<string, unknown> {
  const scrapedJob = scrape?.job;
  const enhancedExperiences = toSelectedExperiences(profile.experience, documentContent);

  return {
    company_name: jobApplication.tracking.companyName ?? scrapedJob?.companyName ?? "",
    full_name: profile.fullName,
    email: profile.email,
    profession: profile.profession ?? "",
    headline: profile.headline ?? "",
    job_description: scrapedJob?.description ?? "",
    job_location: scrapedJob?.location ?? jobApplication.tracking.roleType ?? "",
    location: profile.location ?? "",
    links: profile.links,
    role_title: jobApplication.tracking.roleTitle ?? scrapedJob?.title ?? "",
    summary:
      documentContent.selections?.customizedSummary === "original"
        ? profile.summary
          ? documentContentFromText(profile.summary)
          : documentContent.customizedSummary
        : documentContent.customizedSummary,
    raw_summary: profile.summary ?? "",
    skills:
      documentContent.selections?.skills === "original"
        ? profile.skills
        : documentContent.skillSuggestions && documentContent.skillSuggestions.length > 0
          ? documentContent.skillSuggestions
          : profile.skills,
    education_list: profile.education,
    selected_education: toSelectedEducation(profile.education, documentContent),
    experience_list: enhancedExperiences,
    raw_experience_list: profile.experience,
    selected_experiences: enhancedExperiences,
    match_score: analysis.matchScore,
    missing_skills: analysis.missingSkills,
    strong_skills: analysis.strongSkills,
    recommended_achievements: analysis.recommendedAchievements,
    customized_summary: documentContent.customizedSummary,
    interview_tips: analysis.interviewTips,
    cover_letter_guidance: analysis.coverLetterGuidance ?? [],
  };
}

function toSelectedEducation(
  education: ProfileEducation[],
  documentContent: DocumentContent,
): Record<string, unknown>[] {
  return education.map((item, index) => {
    const enhancement = documentContent.educationEnhancements?.find(
      (e) => e.educationIndex === index,
    );
    const selection = documentContent.selections?.education?.[String(index)];
    const startDate = item.startDate ?? "";
    const endDate = item.endDate ?? "";

    const description =
      selection?.description === "ai" && enhancement?.description
        ? enhancement.description
        : undefined;

    const achievements =
      selection?.achievements && enhancement?.achievements
        ? item.achievements.map((achievement, achievementIndex) => {
            const achievementSelection = selection.achievements[String(achievementIndex)];
            if (
              achievementSelection === "original" ||
              !enhancement.achievements[achievementIndex]
            ) {
              return documentContentFromText(achievement);
            }
            return enhancement.achievements[achievementIndex];
          })
        : enhancement?.achievements && enhancement.achievements.length > 0
          ? enhancement.achievements
          : item.achievements.map(documentContentFromText);

    return {
      institution: item.institution,
      degree: item.degree ?? "",
      field: item.field ?? "",
      start_date: startDate,
      end_date: endDate || "Present",
      period: formatPeriod(startDate, endDate),
      achievements,
      ...(description ? { description } : {}),
    };
  });
}

function toSelectedExperiences(
  experiences: ProfileExperience[],
  documentContent: DocumentContent,
): Record<string, unknown>[] {
  return experiences.map((experience, index) => {
    const enhancement = documentContent.experienceEnhancements.find(
      (item) => item.experienceIndex === index,
    );
    const selection = documentContent.selections?.experience?.[String(index)];
    const startDate = experience.startDate ?? "";
    const endDate = experience.endDate ?? "";

    const description =
      selection?.description === "original"
        ? experience.description
          ? documentContentFromText(experience.description)
          : undefined
        : (enhancement?.description ??
          (experience.description ? documentContentFromText(experience.description) : undefined));

    const achievements = selection?.achievements
      ? experience.achievements.map((achievement, achievementIndex) => {
          const achievementSelection = selection.achievements[String(achievementIndex)];
          if (
            achievementSelection === "original" ||
            !enhancement?.achievements?.[achievementIndex]
          ) {
            return documentContentFromText(achievement);
          }
          return enhancement.achievements[achievementIndex];
        })
      : enhancement?.achievements && enhancement.achievements.length > 0
        ? enhancement.achievements
        : experience.achievements.map(documentContentFromText);

    return {
      title: experience.title,
      company: experience.company,
      start_date: startDate,
      end_date: endDate || "Present",
      period: formatPeriod(startDate, endDate),
      description,
      achievements,
      skills: experience.skills ?? [],
    };
  });
}

function documentContentFromText(value: string) {
  return documentContentFromMatchAnalysis({ customizedSummary: value }).customizedSummary;
}

function formatPeriod(startDate: string, endDate: string): string {
  if (!startDate && !endDate) {
    return "";
  }

  return `${startDate || "Start not set"} - ${endDate || "Present"}`;
}
