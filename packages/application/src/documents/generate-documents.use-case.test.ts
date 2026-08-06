import { describe, expect, it, vi } from "vitest";
import type {
  DocxTemplateRenderer,
  FileStorage,
  RichDocument,
  StoredFileInput,
  TemplateRenderer,
} from "@careerden/domain";
import { richDocumentFromText, richDocumentToPlainText } from "@careerden/domain";
import {
  InMemoryJobApplicationRepository,
  InMemoryUserProfileRepository,
} from "@careerden/infrastructure";
import { GenerateDocumentsUseCase } from "./generate-documents.use-case.js";

describe("GenerateDocumentsUseCase", () => {
  it("creates a PDF preview next to every custom DOCX document", async () => {
    const profiles = new InMemoryUserProfileRepository();
    const jobApplications = new InMemoryJobApplicationRepository();
    const profile = await profiles.create({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      skills: ["TypeScript"],
      experience: [],
    });
    await profiles.createDocumentTemplate({
      profileId: profile.id,
      kind: "cv",
      format: "docx",
      fileId: "templates/cv.docx",
      fileName: "cv.docx",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 10,
      placeholders: ["full_name"],
      fieldMappings: { full_name: "full_name" },
    });
    const jobApplication = await jobApplications.create({ profileId: profile.id });
    const docxToPdf = vi.fn(async () => Buffer.from("docx-preview"));
    const useCase = new GenerateDocumentsUseCase(
      createHtmlTemplates(),
      { htmlToPdf: vi.fn(async () => Buffer.from("html-pdf")) },
      createStorage(),
      jobApplications,
      profiles,
      {
        extractPlaceholders: vi.fn(),
        isPlaceholderStandalone: vi.fn(async () => true),
        render: vi.fn(async () => Buffer.from("docx")),
      },
      { docxToPdf },
    );

    const generated = await useCase.execute({
      jobApplicationId: jobApplication.id,
      jobApplication,
      profile,
      analysis: {
        matchScore: 90,
        missingSkills: [],
        strongSkills: ["TypeScript"],
        recommendedAchievements: [],
        customizedSummary: "Summary",
        interviewTips: [],
      },
    });

    expect(generated.map(({ kind, format }) => ({ kind, format }))).toEqual([
      { kind: "cv", format: "docx" },
      { kind: "cv", format: "pdf" },
      { kind: "cover_letter", format: "pdf" },
    ]);
    expect(docxToPdf).toHaveBeenCalledWith(Buffer.from("docx"));
  });

  it("passes original rich summary, experience, and project selections to DOCX templates", async () => {
    const profiles = new InMemoryUserProfileRepository();
    const jobApplications = new InMemoryJobApplicationRepository();
    const originalSummary = richDocumentFromText("Original summary.");
    const originalDescription = {
      version: 1 as const,
      blocks: [
        {
          type: "bulletList" as const,
          items: [
            {
              blocks: [
                {
                  type: "paragraph" as const,
                  children: [
                    {
                      type: "text" as const,
                      text: "Built automation.",
                      marks: [{ type: "bold" as const }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const profile = await profiles.create({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      summary: "Original summary.",
      summaryRichText: originalSummary,
      skills: ["TypeScript"],
      certifications: ["Azure Fundamentals"],
      education: [
        {
          degree: "BSc",
          field: "Computer Science",
          institution: "Example University",
          startDate: "2018",
          endDate: "2022",
        },
      ],
      experience: [
        {
          company: "Analytical Engines",
          title: "Engineer",
          startDate: "2022",
          description: "Built automation.",
          descriptionRichText: originalDescription,
        },
      ],
      projects: [
        {
          name: "Careerden",
          description: "Built profile-aware documents.",
          descriptionRichText: originalDescription,
          skills: ["TypeScript"],
          achievements: ["Launched automated tailoring"],
        },
      ],
    });
    await profiles.createDocumentTemplate({
      profileId: profile.id,
      kind: "cv",
      format: "docx",
      fileId: "templates/cv.docx",
      fileName: "cv.docx",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 10,
      placeholders: ["experiences"],
      fieldMappings: { experiences: "selected_experiences" },
      isDefault: true,
    });
    const jobApplication = await jobApplications.create({
      profileId: profile.id,
      companyName: "Example Inc",
      roleTitle: "Backend Engineer",
    });
    const capturedDocxData: Record<string, unknown>[] = [];
    const storage = createStorage();
    const htmlTemplates = createHtmlTemplates();
    const htmlToPdf = vi.fn(async () => Buffer.from("pdf"));
    const docxTemplates: DocxTemplateRenderer = {
      extractPlaceholders: vi.fn(),
      isPlaceholderStandalone: vi.fn(async () => true),
      render: vi.fn(async (input) => {
        capturedDocxData.push(input.data);
        return Buffer.from("docx");
      }),
    };
    const useCase = new GenerateDocumentsUseCase(
      htmlTemplates,
      { htmlToPdf },
      storage,
      jobApplications,
      profiles,
      docxTemplates,
    );

    const generated = await useCase.execute({
      jobApplicationId: jobApplication.id,
      jobApplication,
      profile,
      analysis: {
        matchScore: 90,
        missingSkills: [],
        strongSkills: ["TypeScript"],
        recommendedAchievements: ["Enhanced achievement."],
        customizedSummary: "Enhanced summary.",
        interviewTips: ["Prepare examples."],
        experienceEnhancements: [
          {
            experienceIndex: 0,
            enhancedDescription: "Built TypeScript automation for backend systems.",
          },
        ],
      },
      documentContent: {
        coverLetterContent: richDocumentFromText("Reviewed cover letter."),
        customizedSummary: richDocumentFromText("User-edited summary."),
        experienceEnhancements: [
          {
            experienceIndex: 0,
            description: richDocumentFromText(
              "User-edited TypeScript automation for backend systems.",
            ),
          },
        ],
        projectEnhancements: [
          {
            projectIndex: 0,
            description: richDocumentFromText("AI-enhanced project description."),
          },
        ],
        educationEnhancements: [
          {
            educationIndex: 0,
            description: richDocumentFromText("Relevant computer science coursework."),
          },
        ],
        skillSuggestions: ["TypeScript", "Node.js"],
        certificationSuggestions: ["AWS Practitioner"],
        selections: {
          certifications: "ai",
          customizedSummary: "original",
          experience: {
            "0": { description: "original" },
          },
          education: {
            "0": { description: "ai" },
          },
          projects: {
            "0": { description: "original" },
          },
          skills: "ai",
        },
      },
    });

    expect(capturedDocxData[0]?.selected_experiences).toEqual([
      {
        title: "Engineer",
        company: "Analytical Engines",
        start_date: "2022",
        end_date: "Present",
        period: "2022 - Present",
        // Choosing the profile text now preserves its real formatting instead of flattening it.
        description: originalDescription,
      },
    ]);
    expect(capturedDocxData[0]?.selected_projects).toEqual([
      {
        name: "Careerden",
        url: "",
        skills: ["TypeScript"],
        description: richDocumentFromText("Built automation. Launched automated tailoring."),
      },
    ]);
    expect(capturedDocxData[0]?.summary).toEqual(originalSummary);
    expect(capturedDocxData[0]?.customized_summary).toEqual(originalSummary);
    expect(capturedDocxData[0]?.skills).toEqual(["TypeScript", "Node.js"]);
    expect(capturedDocxData[0]?.certifications).toEqual(["AWS Practitioner"]);
    expect(capturedDocxData[0]?.selected_education).toHaveLength(1);
    const selectedEducation = capturedDocxData[0]?.selected_education as Array<{
      description: RichDocument;
    }>;
    expect(richDocumentToPlainText(selectedEducation[0]!.description)).toBe(
      "Relevant computer science coursework.",
    );
    const educationContent = capturedDocxData[0]?.education_content as RichDocument[];
    expect(richDocumentToPlainText(educationContent[0]!)).toBe(
      "Example University\nBSc, Computer Science · 2018 - 2022\nRelevant computer science coursework.",
    );
    const experienceContent = capturedDocxData[0]?.experience_content as RichDocument[];
    expect(richDocumentToPlainText(experienceContent[0]!)).toBe(
      "Engineer · Analytical Engines\n2022 - Present\nBuilt automation.",
    );
    const projectContent = capturedDocxData[0]?.project_content as RichDocument[];
    expect(richDocumentToPlainText(projectContent[0]!)).toContain(
      "Careerden\nTypeScript\nBuilt automation. Launched automated tailoring.",
    );
    expect(capturedDocxData[0]?.experience_list).toEqual(capturedDocxData[0]?.selected_experiences);
    expect(capturedDocxData[0]?.raw_experience_list).toEqual([
      {
        company: "Analytical Engines",
        title: "Engineer",
        startDate: "2022",
        description: "Built automation.",
        descriptionRichText: originalDescription,
      },
    ]);
    expect(capturedDocxData[0]?.raw_summary).toBe("Original summary.");
    expect(generated.map(({ format, kind }) => ({ format, kind }))).toEqual([
      { format: "docx", kind: "cv" },
      { format: "pdf", kind: "cover_letter" },
    ]);
    expect(storage.put).toHaveBeenCalledTimes(2);
    expect(storage.put).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ fileName: "cv.docx" }),
    );
    expect(storage.put).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ fileName: "cover-letter.pdf" }),
    );
    expect(htmlTemplates.render).toHaveBeenCalledOnce();
    expect(htmlTemplates.render).toHaveBeenCalledWith(
      "cover-letter.default",
      expect.objectContaining({
        cover_letter_content: richDocumentFromText("Reviewed cover letter."),
      }),
    );
    expect(htmlToPdf).toHaveBeenCalledOnce();

    const staged = await useCase.stage({
      jobApplicationId: jobApplication.id,
      generationAttemptId: "attempt-1",
      jobApplication,
      profile,
      analysis: {
        matchScore: 90,
        missingSkills: [],
        strongSkills: ["TypeScript"],
        recommendedAchievements: [],
        customizedSummary: "Summary",
        interviewTips: [],
      },
    });
    expect(staged.map((document) => document.fileId)).toEqual([
      `job-applications/${jobApplication.id}/document-generations/attempt-1/cv.docx`,
      `job-applications/${jobApplication.id}/document-generations/attempt-1/cover-letter.pdf`,
    ]);
  });

  it("renders a selected cover letter template as DOCX with the reviewed Content body", async () => {
    const profiles = new InMemoryUserProfileRepository();
    const jobApplications = new InMemoryJobApplicationRepository();
    const profile = await profiles.create({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      skills: ["TypeScript"],
      experience: [],
    });
    await profiles.createDocumentTemplate({
      profileId: profile.id,
      kind: "cv",
      format: "docx",
      fileId: "templates/cv.docx",
      fileName: "cv.docx",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 10,
      placeholders: ["full_name"],
      fieldMappings: { full_name: "full_name" },
      isDefault: true,
    });
    await profiles.createDocumentTemplate({
      profileId: profile.id,
      kind: "cover_letter",
      format: "docx",
      fileId: "templates/cover-letter.docx",
      fileName: "cover-letter.docx",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 10,
      placeholders: ["letter_body"],
      fieldMappings: { letter_body: "cover_letter_content" },
      isDefault: false,
    });
    const jobApplication = await jobApplications.create({ profileId: profile.id });
    const storage = createStorage();
    const docxTemplates: DocxTemplateRenderer = {
      extractPlaceholders: vi.fn(),
      isPlaceholderStandalone: vi.fn(async () => true),
      render: vi.fn(async () => Buffer.from("docx")),
    };
    const useCase = new GenerateDocumentsUseCase(
      createHtmlTemplates(),
      { htmlToPdf: vi.fn() },
      storage,
      jobApplications,
      profiles,
      docxTemplates,
    );
    const coverLetterContent = richDocumentFromText("Dear hiring team,\nI am ready to contribute.");

    const generated = await useCase.execute({
      jobApplicationId: jobApplication.id,
      jobApplication,
      profile,
      analysis: {
        matchScore: 90,
        missingSkills: [],
        strongSkills: ["TypeScript"],
        recommendedAchievements: [],
        customizedSummary: "Summary",
        interviewTips: [],
      },
      documentContent: {
        coverLetterContent,
        customizedSummary: richDocumentFromText("Summary"),
        experienceEnhancements: [],
      },
    });

    expect(generated.map(({ format, kind }) => ({ format, kind }))).toEqual([
      { format: "docx", kind: "cv" },
      { format: "docx", kind: "cover_letter" },
    ]);
    expect(docxTemplates.render).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        template: expect.objectContaining({ kind: "cover_letter" }),
        data: expect.objectContaining({ cover_letter_content: coverLetterContent }),
      }),
    );
    expect(storage.put).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ fileName: "cover-letter.docx" }),
    );
  });
});

function createHtmlTemplates(): TemplateRenderer {
  return {
    render: vi.fn(async () => "<html><body>Cover letter</body></html>"),
  };
}

function createStorage(): FileStorage {
  return {
    put: vi.fn(async (file: StoredFileInput) => ({
      id: file.key ?? `files/${file.fileName}`,
      fileName: file.fileName,
      contentType: file.contentType,
      size: file.body.byteLength,
    })),
    get: vi.fn(async () => ({
      id: "templates/cv.docx",
      fileName: "cv.docx",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 10,
      body: Buffer.from("template"),
    })),
    getSignedUrl: vi.fn(),
    delete: vi.fn(),
  };
}
