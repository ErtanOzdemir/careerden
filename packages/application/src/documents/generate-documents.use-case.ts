import type {
  DocumentRenderer,
  DocumentContent,
  DocumentTemplate,
  DocumentTemplateKind,
  DocxPdfRenderer,
  DocxTemplateRenderer,
  FileStorage,
  GeneratedDocument,
  JobApplicationRepository,
  JobApplication,
  MatchAnalysisResult,
  RichDocument,
  ScrapeBundle,
  TemplateRenderer,
  UserProfile,
  UserProfileRepository,
} from "@link2cv/domain";
import { documentContentFromMatchAnalysis } from "@link2cv/domain";
import { hasValidCoverLetterContentMapping } from "../profiles/document-template-mapping.js";
import {
  resolveDocumentContent,
  type ResolvedDocumentEducation,
  type ResolvedDocumentExperience,
  type ResolvedDocumentProject,
} from "./resolve-document-content.js";

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
    private readonly docxPdf?: DocxPdfRenderer,
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
    const cvTemplate = await this.findTemplate(
      input.profile.id,
      "cv",
      input.jobApplication.applicationPackPreferences.cvTemplateId,
    );
    const defaultCoverLetterTemplate = await this.profiles.findDefaultDocumentTemplate(
      input.profile.id,
      "cover_letter",
    );
    const coverLetterTemplate = input.jobApplication.applicationPackPreferences
      .coverLetterTemplateId
      ? await this.findTemplate(
          input.profile.id,
          "cover_letter",
          input.jobApplication.applicationPackPreferences.coverLetterTemplateId,
        )
      : (defaultCoverLetterTemplate ??
        soleReadyCoverLetterTemplate(await this.profiles.listDocumentTemplates(input.profile.id)));

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
      if (this.docxPdf) {
        generated.push(
          await store({
            kind: "cv",
            format: "pdf",
            fileName: "cv.pdf",
            contentType: "application/pdf",
            body: await this.docxPdf.docxToPdf(docx),
          }),
        );
      }
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
      if (this.docxPdf) {
        generated.push(
          await store({
            kind: "cover_letter",
            format: "pdf",
            fileName: "cover-letter.pdf",
            contentType: "application/pdf",
            body: await this.docxPdf.docxToPdf(docx),
          }),
        );
      }
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

  private async findTemplate(
    profileId: string,
    kind: DocumentTemplateKind,
    selectedTemplateId?: string,
  ): Promise<DocumentTemplate | null> {
    if (!selectedTemplateId) {
      return this.profiles.findDefaultDocumentTemplate(profileId, kind);
    }

    const template = await this.profiles.findDocumentTemplateById(selectedTemplateId);
    if (!template || template.profileId !== profileId || template.kind !== kind) {
      throw new Error(`Selected ${kind === "cv" ? "CV" : "cover letter"} template is unavailable`);
    }

    return template;
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
  const resolved = resolveDocumentContent(profile, documentContent);
  const selectedExperiences = resolved.experiences.map(toSelectedExperience);
  const selectedEducation = resolved.education.map(toSelectedEducation);
  const selectedProjects = resolved.projects.map(toSelectedProject);

  return {
    cover_letter_content: resolved.coverLetterContent,
    company_name: jobApplication.tracking.companyName ?? scrapedJob?.companyName ?? "",
    full_name: profile.fullName,
    email: profile.email,
    profession: profile.profession ?? "",
    headline: profile.headline ?? "",
    profile_title: profile.headline ?? profile.profession ?? "",
    job_description: scrapedJob?.description ?? "",
    job_location: scrapedJob?.location ?? jobApplication.tracking.roleType ?? "",
    location: profile.location ?? "",
    links: profile.links,
    role_title: jobApplication.tracking.roleTitle ?? scrapedJob?.title ?? "",
    summary: resolved.summary,
    raw_summary: profile.summary ?? "",
    skills: resolved.skills,
    certifications: resolved.certifications,
    education_list: selectedEducation,
    selected_education: selectedEducation,
    experience_list: selectedExperiences,
    raw_experience_list: profile.experience,
    raw_education_list: profile.education,
    raw_projects: profile.projects,
    selected_experiences: selectedExperiences,
    selected_projects: selectedProjects,
    projects: selectedProjects,
    experience_content: resolved.experiences.map(toExperienceContent),
    education_content: resolved.education.map(toEducationContent),
    project_content: resolved.projects.map(toProjectContent),
    match_score: analysis.matchScore,
    missing_skills: analysis.missingSkills,
    strong_skills: analysis.strongSkills,
    recommended_achievements: analysis.recommendedAchievements,
    customized_summary: resolved.summary,
    interview_tips: analysis.interviewTips,
    cover_letter_guidance: analysis.coverLetterGuidance ?? [],
  };
}

function toSelectedExperience(experience: ResolvedDocumentExperience): Record<string, unknown> {
  const startDate = experience.startDate ?? "";
  const endDate = experience.endDate ?? "";

  return {
    title: experience.title,
    company: experience.company,
    start_date: startDate,
    end_date: endDate || "Present",
    period: formatPeriod(startDate, endDate),
    ...(experience.description ? { description: experience.description } : {}),
  };
}

function toSelectedEducation(education: ResolvedDocumentEducation): Record<string, unknown> {
  const startDate = education.startDate ?? "";
  const endDate = education.endDate ?? "";

  return {
    institution: education.institution,
    degree: education.degree ?? "",
    field: education.field ?? "",
    start_date: startDate,
    end_date: endDate || "Present",
    period: formatPeriod(startDate, endDate),
    ...(education.description ? { description: education.description } : {}),
  };
}

function toSelectedProject(project: ResolvedDocumentProject): Record<string, unknown> {
  return {
    name: project.name,
    url: project.url ?? "",
    skills: project.skills,
    ...(project.description ? { description: project.description } : {}),
  };
}

function toExperienceContent(experience: ResolvedDocumentExperience): RichDocument {
  return toItemContent(
    `${experience.title} · ${experience.company}`,
    formatPeriod(experience.startDate ?? "", experience.endDate ?? ""),
    experience.description,
  );
}

function toEducationContent(education: ResolvedDocumentEducation): RichDocument {
  return toItemContent(
    education.institution,
    [
      [education.degree, education.field].filter(Boolean).join(", "),
      formatPeriod(education.startDate ?? "", education.endDate ?? ""),
    ]
      .filter(Boolean)
      .join(" · "),
    education.description,
  );
}

function toProjectContent(project: ResolvedDocumentProject): RichDocument {
  return toItemContent(
    project.name,
    [project.url, project.skills.join(", ")].filter(Boolean).join(" · "),
    project.description,
  );
}

function toItemContent(title: string, metadata: string, description?: RichDocument): RichDocument {
  return {
    version: 1,
    blocks: [
      {
        type: "heading",
        level: 3,
        children: [{ type: "text", text: title }],
      },
      ...(metadata
        ? [
            {
              type: "paragraph" as const,
              children: [
                { type: "text" as const, text: metadata, marks: [{ type: "italic" as const }] },
              ],
            },
          ]
        : []),
      ...(description?.blocks ?? []),
    ],
  };
}

function formatPeriod(startDate: string, endDate: string): string {
  if (!startDate && !endDate) {
    return "";
  }

  return `${startDate || "Start not set"} - ${endDate || "Present"}`;
}
