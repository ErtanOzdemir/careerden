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
import { GenerateDocumentsUseCase } from "./generate-documents.js";

describe("GenerateDocumentsUseCase", () => {
  it("passes AI-enhanced selected experiences with dates to DOCX templates", async () => {
    const profiles = new InMemoryUserProfileRepository();
    const jobApplications = new InMemoryJobApplicationRepository();
    const profile = await profiles.create({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      skills: ["TypeScript"],
      experience: [
        {
          company: "Analytical Engines",
          title: "Engineer",
          startDate: "2022",
          description: "Built automation.",
          achievements: ["Improved reliability."],
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
      },
    });

    expect(capturedDocxData[0]?.selected_experiences).toEqual([
      {
        title: "Engineer",
        company: "Analytical Engines",
        start_date: "2022",
        end_date: "Present",
        period: "2022 - Present",
        description: richDocumentFromText("User-edited TypeScript automation for backend systems."),
        achievements: [richDocumentFromText("User-edited backend reliability achievement.")],
        skills: [],
      },
    ]);
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
    expect(htmlToPdf).toHaveBeenCalledOnce();
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
      id: `files/${file.fileName}`,
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
