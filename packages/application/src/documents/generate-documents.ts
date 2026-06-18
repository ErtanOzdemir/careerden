import type {
  DocumentRenderer,
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
  }): Promise<GeneratedDocument[]> {
    const scrape = await this.jobApplications.getScrapeBundle(input.jobApplicationId);
    const data = toTemplateData(input.profile, input.analysis, input.jobApplication, scrape);
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
  jobApplication: JobApplication,
  scrape: ScrapeBundle | null,
): Record<string, unknown> {
  const scrapedJob = scrape?.job;

  return {
    company_name: jobApplication.tracking.companyName ?? scrapedJob?.companyName ?? "",
    full_name: profile.fullName,
    email: profile.email,
    headline: profile.headline ?? "",
    job_description: scrapedJob?.description ?? "",
    job_location: scrapedJob?.location ?? jobApplication.tracking.roleType ?? "",
    location: profile.location ?? "",
    role_title: jobApplication.tracking.roleTitle ?? scrapedJob?.title ?? "",
    summary: profile.summary ?? "",
    skills: profile.skills,
    education_list: profile.education,
    selected_education: toSelectedEducation(profile.education),
    experience_list: profile.experience,
    selected_experiences: toSelectedExperiences(profile.experience, analysis),
    match_score: analysis.matchScore,
    missing_skills: analysis.missingSkills,
    strong_skills: analysis.strongSkills,
    recommended_achievements: analysis.recommendedAchievements,
    customized_summary: analysis.customizedSummary,
    interview_tips: analysis.interviewTips,
    cover_letter_guidance: analysis.coverLetterGuidance ?? [],
  };
}

function toSelectedEducation(education: ProfileEducation[]): Record<string, unknown>[] {
  return education.map((item) => {
    const startDate = item.startDate ?? "";
    const endDate = item.endDate ?? "";

    return {
      institution: item.institution,
      degree: item.degree ?? "",
      field: item.field ?? "",
      start_date: startDate,
      end_date: endDate || "Present",
      period: formatPeriod(startDate, endDate),
      achievements: item.achievements,
    };
  });
}

function toSelectedExperiences(
  experiences: ProfileExperience[],
  analysis: MatchAnalysisResult,
): Record<string, unknown>[] {
  return experiences.map((experience, index) => {
    const enhancement = analysis.experienceEnhancements?.find(
      (item) => item.experienceIndex === index,
    );
    const startDate = experience.startDate ?? "";
    const endDate = experience.endDate ?? "";

    return {
      title: experience.title,
      company: experience.company,
      start_date: startDate,
      end_date: endDate || "Present",
      period: formatPeriod(startDate, endDate),
      description: enhancement?.enhancedDescription ?? experience.description ?? "",
      achievements:
        enhancement?.enhancedAchievements && enhancement.enhancedAchievements.length > 0
          ? enhancement.enhancedAchievements
          : experience.achievements,
      skills: experience.skills ?? [],
    };
  });
}

function formatPeriod(startDate: string, endDate: string): string {
  if (!startDate && !endDate) {
    return "";
  }

  return `${startDate || "Start not set"} - ${endDate || "Present"}`;
}
