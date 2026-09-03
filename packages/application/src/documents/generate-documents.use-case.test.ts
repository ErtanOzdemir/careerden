import { describe, expect, it, vi } from "vitest";
import type { FileStorage, RichDocument, StoredFileInput, TemplateRenderer } from "@careerden/domain";
import { richDocumentFromText, richDocumentToPlainText } from "@careerden/domain";
import {
  InMemoryJobApplicationRepository,
  InMemoryUserProfileRepository,
} from "@careerden/infrastructure";
import { GenerateDocumentsUseCase } from "./generate-documents.use-case.js";

describe("GenerateDocumentsUseCase", () => {
  it("renders CV and cover letter as HTML-derived PDFs using the default templates", async () => {
    const profiles = new InMemoryUserProfileRepository();
    const jobApplications = new InMemoryJobApplicationRepository();
    const profile = await profiles.create({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      skills: ["TypeScript"],
      experience: [],
    });
    const jobApplication = await jobApplications.create({ profileId: profile.id });
    const htmlToPdf = vi.fn(async () => Buffer.from("pdf"));
    const htmlTemplates = createHtmlTemplates();
    const useCase = new GenerateDocumentsUseCase(
      htmlTemplates,
      { htmlToPdf },
      createStorage(),
      jobApplications,
      profiles,
    );

    const generated = await useCase.execute({
      jobApplicationId: jobApplication.id,
      jobApplication,
      profile,
      analysis: {
        matchScore: 90,
        missingSkills: [],
        strongSkills: ["TypeScript"],
        summaryTips: [],
        interviewTips: [],
      },
    });

    expect(generated.map(({ kind, format }) => ({ kind, format }))).toEqual([
      { kind: "cv", format: "pdf" },
      { kind: "cover_letter", format: "pdf" },
    ]);
    expect(htmlTemplates.render).toHaveBeenNthCalledWith(1, "cv.default", expect.any(Object));
    expect(htmlTemplates.render).toHaveBeenNthCalledWith(
      2,
      "cover-letter.default",
      expect.any(Object),
    );
    expect(htmlToPdf).toHaveBeenCalledTimes(2);
  });

  it("resolves the per-application template override before the profile default and registry fallback", async () => {
    const profiles = new InMemoryUserProfileRepository();
    const jobApplications = new InMemoryJobApplicationRepository();
    const profile = await profiles.create({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      skills: [],
      experience: [],
    });
    await profiles.update(profile.id, { defaultCvTemplateId: "cv.default" });
    const jobApplication = await jobApplications.create({
      profileId: profile.id,
      applicationPackPreferences: {
        language: "auto",
        tone: "professional",
        // An unknown id must be skipped in favor of the profile default rather than throwing.
        cvTemplateId: "unknown-template",
      },
    });
    const htmlTemplates = createHtmlTemplates();
    const useCase = new GenerateDocumentsUseCase(
      htmlTemplates,
      { htmlToPdf: vi.fn(async () => Buffer.from("pdf")) },
      createStorage(),
      jobApplications,
      profiles,
    );

    await useCase.execute({
      jobApplicationId: jobApplication.id,
      jobApplication,
      profile,
      analysis: {
        matchScore: 90,
        missingSkills: [],
        strongSkills: [],
        summaryTips: [],
        interviewTips: [],
      },
    });

    expect(htmlTemplates.render).toHaveBeenNthCalledWith(1, "cv.default", expect.any(Object));
  });

  it("passes original rich summary, experience, and project selections to the HTML template", async () => {
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
    const jobApplication = await jobApplications.create({
      profileId: profile.id,
      companyName: "Example Inc",
      roleTitle: "Backend Engineer",
    });
    const capturedData: Record<string, unknown>[] = [];
    const storage = createStorage();
    const htmlTemplates: TemplateRenderer = {
      render: vi.fn(async (_templateId, data) => {
        capturedData.push(data);
        return "<html></html>";
      }),
    };
    const htmlToPdf = vi.fn(async () => Buffer.from("pdf"));
    const useCase = new GenerateDocumentsUseCase(
      htmlTemplates,
      { htmlToPdf },
      storage,
      jobApplications,
      profiles,
    );

    const generated = await useCase.execute({
      jobApplicationId: jobApplication.id,
      jobApplication,
      profile,
      analysis: {
        matchScore: 90,
        missingSkills: [],
        strongSkills: ["TypeScript"],
        summaryTips: ["Lead with the enhanced achievement."],
        interviewTips: ["Prepare examples."],
        experienceTips: [
          {
            experienceIndex: 0,
            tips: ["Mention the backend systems focus."],
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
      },
    });

    // Every field's current value (whether hand-edited, tip-revised, or untouched) is used directly
    // now — there is no AI-vs-original selection to route through.
    expect(capturedData[0]?.selected_experiences).toEqual([
      {
        title: "Engineer",
        company: "Analytical Engines",
        start_date: "2022",
        end_date: "Present",
        period: "2022 - Present",
        description: richDocumentFromText(
          "User-edited TypeScript automation for backend systems.",
        ),
      },
    ]);
    expect(capturedData[0]?.selected_projects).toEqual([
      {
        name: "Careerden",
        url: "",
        skills: ["TypeScript"],
        description: richDocumentFromText("AI-enhanced project description."),
      },
    ]);
    expect(capturedData[0]?.summary).toEqual(richDocumentFromText("User-edited summary."));
    expect(capturedData[0]?.customized_summary).toEqual(richDocumentFromText("User-edited summary."));
    expect(capturedData[0]?.skills).toEqual(["TypeScript", "Node.js"]);
    expect(capturedData[0]?.certifications).toEqual(["AWS Practitioner"]);
    expect(capturedData[0]?.selected_education).toHaveLength(1);
    const selectedEducation = capturedData[0]?.selected_education as Array<{
      description: RichDocument;
    }>;
    expect(richDocumentToPlainText(selectedEducation[0]!.description)).toBe(
      "Relevant computer science coursework.",
    );
    const educationContent = capturedData[0]?.education_content as RichDocument[];
    expect(richDocumentToPlainText(educationContent[0]!)).toBe(
      "Example University\nBSc, Computer Science · 2018 - 2022\nRelevant computer science coursework.",
    );
    const experienceContent = capturedData[0]?.experience_content as RichDocument[];
    expect(richDocumentToPlainText(experienceContent[0]!)).toBe(
      "Engineer · Analytical Engines\n2022 - Present\nUser-edited TypeScript automation for backend systems.",
    );
    const projectContent = capturedData[0]?.project_content as RichDocument[];
    expect(richDocumentToPlainText(projectContent[0]!)).toContain(
      "Careerden\nTypeScript\nAI-enhanced project description.",
    );
    expect(capturedData[0]?.experience_list).toEqual(capturedData[0]?.selected_experiences);
    expect(capturedData[0]?.raw_experience_list).toEqual([
      {
        company: "Analytical Engines",
        title: "Engineer",
        startDate: "2022",
        description: "Built automation.",
        descriptionRichText: originalDescription,
      },
    ]);
    expect(capturedData[0]?.raw_summary).toBe("Original summary.");
    expect(generated.map(({ format, kind }) => ({ format, kind }))).toEqual([
      { format: "pdf", kind: "cv" },
      { format: "pdf", kind: "cover_letter" },
    ]);
    expect(storage.put).toHaveBeenCalledTimes(2);
    expect(storage.put).toHaveBeenNthCalledWith(1, expect.objectContaining({ fileName: "cv.pdf" }));
    expect(storage.put).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ fileName: "cover-letter.pdf" }),
    );
    expect(htmlTemplates.render).toHaveBeenNthCalledWith(
      2,
      "cover-letter.default",
      expect.objectContaining({
        cover_letter_content: richDocumentFromText("Reviewed cover letter."),
      }),
    );
    expect(htmlToPdf).toHaveBeenCalledTimes(2);

    const staged = await useCase.stage({
      jobApplicationId: jobApplication.id,
      generationAttemptId: "attempt-1",
      jobApplication,
      profile,
      analysis: {
        matchScore: 90,
        missingSkills: [],
        strongSkills: ["TypeScript"],
        summaryTips: [],
        interviewTips: [],
      },
    });
    expect(staged.map((document) => document.fileId)).toEqual([
      `job-applications/${jobApplication.id}/document-generations/attempt-1/cv.pdf`,
      `job-applications/${jobApplication.id}/document-generations/attempt-1/cover-letter.pdf`,
    ]);
  });

  it("previews HTML for both documents without persisting anything", async () => {
    const profiles = new InMemoryUserProfileRepository();
    const jobApplications = new InMemoryJobApplicationRepository();
    const profile = await profiles.create({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      skills: ["TypeScript"],
      experience: [],
    });
    const jobApplication = await jobApplications.create({ profileId: profile.id });
    const storage = createStorage();
    const htmlTemplates = createHtmlTemplates();
    const useCase = new GenerateDocumentsUseCase(
      htmlTemplates,
      { htmlToPdf: vi.fn() },
      storage,
      jobApplications,
      profiles,
    );
    const coverLetterContent = richDocumentFromText("Dear hiring team,\nI am ready to contribute.");

    const preview = await useCase.preview({
      jobApplicationId: jobApplication.id,
      jobApplication,
      profile,
      analysis: {
        matchScore: 90,
        missingSkills: [],
        strongSkills: ["TypeScript"],
        summaryTips: [],
        interviewTips: [],
      },
      documentContent: {
        coverLetterContent,
        customizedSummary: richDocumentFromText("Summary"),
        experienceEnhancements: [],
      },
    });

    expect(preview.cv.templateId).toBe("cv.default");
    expect(preview.coverLetter.templateId).toBe("cover-letter.default");
    expect(preview.cv.html).toContain("Cover letter");
    expect(storage.put).not.toHaveBeenCalled();
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
