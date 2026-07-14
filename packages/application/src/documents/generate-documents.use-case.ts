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
  ProfileProject,
  ScrapeBundle,
  TemplateRenderer,
  UserProfile,
  UserProfileRepository,
} from "@link2cv/domain";
import { documentContentFromMatchAnalysis, richDocumentFromText } from "@link2cv/domain";
import { hasValidCoverLetterContentMapping } from "../profiles/document-template-mapping.js";

export interface GeneratedDocumentUpload {
  kind: "cover_letter" | "cv";
  format: "docx" | "pdf";
  fileId: string;
  fileName: string;
  contentType: string;
}

interface GeneratedDocumentBody {
  kind: GeneratedDocumentUpload["kind"];
  format: GeneratedDocumentUpload["format"];
  fileName: string;
  contentType: string;
  body: Buffer;
}

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
    return this.generate(input, (document) =>
      this.storeAndAttachGeneratedDocument(input.jobApplicationId, document),
    );
  }

  async stage(input: {
    jobApplicationId: string;
    generationAttemptId: string;
    jobApplication: JobApplication;
    profile: UserProfile;
    analysis: MatchAnalysisResult;
    documentContent?: DocumentContent;
  }): Promise<GeneratedDocumentUpload[]> {
    return this.generate(input, (document) =>
      this.storeStagedDocument(input.jobApplicationId, input.generationAttemptId, document),
    );
  }

  private async generate<T>(
    input: {
      jobApplicationId: string;
      jobApplication: JobApplication;
      profile: UserProfile;
      analysis: MatchAnalysisResult;
      documentContent?: DocumentContent;
    },
    store: (document: GeneratedDocumentBody) => Promise<T>,
  ): Promise<T[]> {
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
    const generated: T[] = [];
    const cvTemplate = await this.profiles.findDefaultDocumentTemplate(input.profile.id, "cv");
    const defaultCoverLetterTemplate = await this.profiles.findDefaultDocumentTemplate(
      input.profile.id,
      "cover_letter",
    );
    const coverLetterTemplate =
      defaultCoverLetterTemplate ??
      soleReadyCoverLetterTemplate(await this.profiles.listDocumentTemplates(input.profile.id));

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
        await store({
          kind: "cv",
          format: "docx",
          fileName: "cv.docx",
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          body: docx,
        }),
      );
    } else {
      generated.push(
        await this.renderHtmlPdf(
          {
            templateId: "cv.default",
            kind: "cv",
            fileName: "cv.pdf",
            data,
          },
          store,
        ),
      );
    }

    if (coverLetterTemplate) {
      if (!this.docxTemplates) {
        throw new Error("DOCX template rendering is not configured");
      }
      if (!hasValidCoverLetterContentMapping(coverLetterTemplate)) {
        throw new Error("Default cover letter template does not have a valid content mapping");
      }

      const templateFile = await this.storage.get(coverLetterTemplate.fileId);
      const docx = await this.docxTemplates.render({
        template: coverLetterTemplate,
        templateBody: templateFile.body,
        data,
      });
      generated.push(
        await store({
          kind: "cover_letter",
          format: "docx",
          fileName: "cover-letter.docx",
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          body: docx,
        }),
      );
    } else {
      generated.push(
        await this.renderHtmlPdf(
          {
            templateId: "cover-letter.default",
            kind: "cover_letter",
            fileName: "cover-letter.pdf",
            data,
          },
          store,
        ),
      );
    }

    return generated;
  }

  private async renderHtmlPdf<T>(
    input: {
      templateId: string;
      kind: "cover_letter" | "cv";
      fileName: string;
      data: Record<string, unknown>;
    },
    store: (document: GeneratedDocumentBody) => Promise<T>,
  ): Promise<T> {
    const html = await this.templates.render(input.templateId, input.data);
    const pdf = await this.documents.htmlToPdf(html.toString());

    return store({
      kind: input.kind,
      format: "pdf",
      fileName: input.fileName,
      contentType: "application/pdf",
      body: pdf,
    });
  }

  private async storeAndAttachGeneratedDocument(
    jobApplicationId: string,
    input: GeneratedDocumentBody,
  ): Promise<GeneratedDocument> {
    const stored = await this.storage.put({
      fileName: input.fileName,
      contentType: input.contentType,
      body: input.body,
      metadata: {
        jobApplicationId,
        kind: input.kind,
        format: input.format,
      },
    });

    return this.jobApplications.attachGeneratedDocument({
      jobApplicationId,
      kind: input.kind,
      format: input.format,
      fileId: stored.id,
      fileName: input.fileName,
      contentType: input.contentType,
    });
  }

  private async storeStagedDocument(
    jobApplicationId: string,
    generationAttemptId: string,
    input: GeneratedDocumentBody,
  ): Promise<GeneratedDocumentUpload> {
    const fileId = generatedDocumentFileId(jobApplicationId, generationAttemptId, input.fileName);
    const stored = await this.storage.put({
      key: fileId,
      fileName: input.fileName,
      contentType: input.contentType,
      body: input.body,
      metadata: {
        jobApplicationId,
        generationAttemptId,
        kind: input.kind,
        format: input.format,
      },
    });
    return {
      kind: input.kind,
      format: input.format,
      fileId: stored.id,
      fileName: input.fileName,
      contentType: input.contentType,
    };
  }
}

function soleReadyCoverLetterTemplate(
  templates: Awaited<ReturnType<UserProfileRepository["listDocumentTemplates"]>>,
) {
  const ready = templates.filter(
    (template) => template.kind === "cover_letter" && hasValidCoverLetterContentMapping(template),
  );

  return ready.length === 1 ? ready[0] : null;
}

export function generatedDocumentFileId(
  jobApplicationId: string,
  generationAttemptId: string,
  fileName: string,
): string {
  return `job-applications/${jobApplicationId}/document-generations/${generationAttemptId}/${fileName}`;
}

export function generatedDocumentFileIds(
  jobApplicationId: string,
  generationAttemptId: string,
): string[] {
  return ["cv.docx", "cv.pdf", "cover-letter.docx", "cover-letter.pdf"].map((fileName) =>
    generatedDocumentFileId(jobApplicationId, generationAttemptId, fileName),
  );
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
  const selectedProjects = toSelectedProjects(profile.projects, documentContent);

  return {
    cover_letter_content: documentContent.coverLetterContent ?? richDocumentFromText(""),
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
        ? (profile.summaryRichText ??
          (profile.summary ? documentContentFromText(profile.summary) : undefined) ??
          documentContent.customizedSummary)
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
    selected_projects: selectedProjects,
    match_score: analysis.matchScore,
    missing_skills: analysis.missingSkills,
    strong_skills: analysis.strongSkills,
    recommended_achievements: analysis.recommendedAchievements,
    customized_summary: documentContent.customizedSummary,
    interview_tips: analysis.interviewTips,
    cover_letter_guidance: analysis.coverLetterGuidance ?? [],
  };
}

function toSelectedProjects(
  projects: ProfileProject[],
  documentContent: DocumentContent,
): Record<string, unknown>[] {
  return projects.map((project, index) => {
    const enhancement = documentContent.projectEnhancements?.find(
      (item) => item.projectIndex === index,
    );
    const selection = documentContent.selections?.projects?.[String(index)];
    const originalDescription =
      project.descriptionRichText ??
      (project.description ? documentContentFromText(project.description) : undefined);
    const description =
      selection?.description === "original"
        ? originalDescription
        : (enhancement?.description ?? originalDescription);
    const achievements = project.achievements.map((achievement, achievementIndex) => {
      const selected = selection?.achievements[String(achievementIndex)];
      const enhanced = enhancement?.achievements[achievementIndex];

      return selected === "original"
        ? documentContentFromText(achievement)
        : (enhanced ?? documentContentFromText(achievement));
    });

    return {
      name: project.name,
      url: project.url ?? "",
      skills: project.skills,
      achievements,
      ...(description ? { description } : {}),
    };
  });
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

    return {
      institution: item.institution,
      degree: item.degree ?? "",
      field: item.field ?? "",
      start_date: startDate,
      end_date: endDate || "Present",
      period: formatPeriod(startDate, endDate),
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
        ? (experience.descriptionRichText ??
          (experience.description ? documentContentFromText(experience.description) : undefined))
        : (enhancement?.description ??
          experience.descriptionRichText ??
          (experience.description ? documentContentFromText(experience.description) : undefined));

    return {
      title: experience.title,
      company: experience.company,
      start_date: startDate,
      end_date: endDate || "Present",
      period: formatPeriod(startDate, endDate),
      description,
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
