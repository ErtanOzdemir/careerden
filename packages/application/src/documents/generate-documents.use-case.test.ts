import { describe, expect, it, vi } from "vitest";
import type {
  DocxTemplateRenderer,
  FileStorage,
  StoredFileInput,
  TemplateRenderer,
} from "@link2cv/domain";
import { richDocumentFromText } from "@link2cv/domain";
import {
  InMemoryJobApplicationRepository,
  InMemoryUserProfileRepository,
} from "@link2cv/infrastructure";
import { GenerateDocumentsUseCase } from "./generate-documents.use-case.js";

describe("GenerateDocumentsUseCase", () => {
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
          name: "Link2CV",
          description: "Built profile-aware documents.",
          descriptionRichText: originalDescription,
          skills: ["TypeScript"],
          achievements: [],
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
            enhancedAchievements: ["Improved backend reliability with TypeScript."],
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
            achievements: [richDocumentFromText("User-edited backend reliability achievement.")],
          },
        ],
        projectEnhancements: [
          {
            projectIndex: 0,
            description: richDocumentFromText("AI-enhanced project description."),
            achievements: [],
          },
        ],
        selections: {
          customizedSummary: "original",
          experience: {
            "0": { description: "original", achievements: {} },
          },
          education: {},
          projects: {
            "0": { description: "original", achievements: {} },
          },
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
        description: originalDescription,
      },
    ]);
    expect(capturedDocxData[0]?.selected_projects).toEqual([
      {
        name: "Link2CV",
        url: "",
        skills: ["TypeScript"],
        achievements: [],
        description: originalDescription,
      },
    ]);
    expect(capturedDocxData[0]?.summary).toEqual(originalSummary);
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
