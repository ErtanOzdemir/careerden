import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ApiApplicationPackPreferences,
  ApiDocumentContent,
  ApiProfile,
  RichDocument,
} from "../api/types.js";
import type { JobApplication } from "../types.js";
import { ApplicationPackWorkspace } from "./ApplicationPackWorkspace.js";

vi.mock("./RichTextEditor.js", () => ({
  default: ({
    ariaLabel,
    onChange,
    value,
  }: {
    ariaLabel: string;
    onChange: (value: RichDocument) => void;
    value: RichDocument;
  }) => (
    <div>
      <div aria-label={ariaLabel}>{richDocumentText(value)}</div>
      <button
        aria-label={`Format ${ariaLabel} as bullet list`}
        onClick={() => onChange(bulletList(richDocumentText(value)))}
        type="button"
      >
        Bullet list
      </button>
    </div>
  ),
  RichTextViewer: ({ ariaLabel, value }: { ariaLabel: string; value: RichDocument }) => (
    <div aria-label={ariaLabel}>{richDocumentText(value)}</div>
  ),
}));

describe("ApplicationPackWorkspace", () => {
  afterEach(cleanup);

  it("presents the CV and cover letter as one ready application pack", async () => {
    const onResolveDocumentUrl = vi.fn(async (documentId: string) => `https://files/${documentId}`);

    renderWorkspace({ onResolveDocumentUrl });

    expect(screen.getByRole("heading", { name: "Application pack" })).toBeInTheDocument();
    expect(screen.getByText("Role match")).toBeInTheDocument();
    expect(screen.getByText("86%")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tailored CV" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cover letter" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download both PDFs" })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTitle("Tailored CV preview")).toHaveAttribute(
        "src",
        "https://files/cv-pdf",
      );
      expect(screen.getByTitle("Cover letter preview")).toHaveAttribute(
        "src",
        "https://files/cover-pdf",
      );
    });
  });

  it("shows every customizable section and updates the complete draft through one action", async () => {
    const onUpdate = vi.fn(async () => undefined);

    renderWorkspace({ onUpdate });

    fireEvent.click(screen.getByRole("button", { name: /Customize this pack/ }));

    for (const section of [
      "Summary",
      "Experience",
      "Skills",
      "Education",
      "Projects",
      "Certifications",
      "Cover Letter",
    ]) {
      expect(screen.getByRole("button", { name: `Customize ${section}` })).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "Edit profile" })).toHaveAttribute("href", "/profile");

    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "tr" } });
    fireEvent.change(screen.getByLabelText("Tone"), { target: { value: "concise" } });

    fireEvent.click(screen.getByRole("button", { name: "Customize Summary" }));
    fireEvent.click(screen.getByRole("button", { name: "Summary source: Use profile" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Format Edit AI CV summary as bullet list" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Customize Experience" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Experience 1 description source: Use profile" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Customize Education" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Education 1 description source: Use profile" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Customize Projects" }));
    expect(screen.getByText("Built a computing model. Designed the compiler.")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Project 1 description source: Use profile" }),
    );
    expect(screen.queryByText("Achievement suggestions")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /achievement/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Customize Skills" }));
    fireEvent.click(screen.getByRole("button", { name: "Skills source: Use profile" }));
    fireEvent.change(screen.getByLabelText("Add AI skill"), { target: { value: "Node.js" } });
    fireEvent.click(screen.getByRole("button", { name: "Add skill" }));

    fireEvent.click(screen.getByRole("button", { name: "Customize Certifications" }));
    fireEvent.click(screen.getByRole("button", { name: "Certifications source: Use profile" }));

    fireEvent.click(screen.getByRole("button", { name: "Customize Cover Letter" }));
    expect(screen.getByLabelText("Edit cover letter")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Update pack" }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledOnce());
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        customizedSummary: expect.objectContaining({
          blocks: expect.arrayContaining([expect.objectContaining({ type: "bulletList" })]),
        }),
        skillSuggestions: ["React", "Node.js"],
        selections: expect.objectContaining({
          certifications: "original",
          customizedSummary: "original",
          experience: expect.objectContaining({
            "0": {
              achievements: {},
              description: "original",
            },
          }),
          education: expect.objectContaining({
            "0": {
              achievements: {},
              description: "original",
            },
          }),
          projects: expect.objectContaining({
            "0": {
              achievements: {},
              description: "original",
            },
          }),
          skills: "original",
        }),
      }),
      { language: "tr", tone: "concise" },
    );
  });

  it("switches to live content for draft changes and keeps the stale PDF accessible", async () => {
    renderWorkspace();

    await waitFor(() => expect(screen.getByTitle("Tailored CV preview")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Customize this pack/ }));
    fireEvent.click(screen.getByRole("button", { name: "Customize Summary" }));
    fireEvent.click(screen.getByRole("button", { name: "Summary source: Use profile" }));

    expect(screen.queryByTitle("Tailored CV preview")).not.toBeInTheDocument();
    const livePreview = screen.getByLabelText("Full CV content preview");
    expect(within(livePreview).getByText("Product engineer.")).toBeInTheDocument();
    expect(screen.getAllByText("Out of date")).toHaveLength(2);
    expect(screen.getAllByText("The PDF does not include your unapplied changes.")).toHaveLength(2);

    fireEvent.click(screen.getAllByRole("button", { name: "Rendered PDF" })[0]);

    await waitFor(() => expect(screen.getByTitle("Tailored CV preview")).toBeInTheDocument());
  });

  it("shows the complete CV content when a legacy pack has DOCX but no PDF preview", () => {
    const app = createApplication();
    const onUpdate = vi.fn(async () => undefined);
    app.processingStatus = "failed";
    app.generatedDocuments = app.generatedDocuments?.filter(
      (document) => document.format === "docx",
    );

    renderWorkspace({ app, onUpdate });

    const preview = screen.getByLabelText("Full CV content preview");
    expect(within(preview).getByText("Ada Lovelace")).toBeInTheDocument();
    expect(within(preview).getByText("Profile")).toBeInTheDocument();
    expect(within(preview).getByText("Tailored product engineer summary.")).toBeInTheDocument();
    expect(within(preview).getByText("Experience")).toBeInTheDocument();
    expect(within(preview).getByText("Product Engineer · Acme")).toBeInTheDocument();
    expect(
      within(preview).getByText("Built product experiences. Shipped React products."),
    ).toBeInTheDocument();
    expect(within(preview).getByText("Skills")).toBeInTheDocument();
    expect(within(preview).getByText("React")).toBeInTheDocument();
    expect(within(preview).getByText("Projects")).toBeInTheDocument();
    expect(within(preview).getByText("Analytical Engine")).toBeInTheDocument();
    expect(
      within(preview).getByText("Tailored project evidence. Improved the compiler design."),
    ).toBeInTheDocument();
    expect(within(preview).getByText("Education")).toBeInTheDocument();
    expect(
      within(preview).getByText(
        "Relevant computer science coursework. Completed systems research.",
      ),
    ).toBeInTheDocument();
    expect(within(preview).getByText("Certifications")).toBeInTheDocument();
    expect(within(preview).getByText("AWS Practitioner")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry PDF previews" }));
    expect(onUpdate).toHaveBeenCalledWith(app.documentContent, app.applicationPackPreferences);
  });

  it("blocks generation when the profile is not ready", () => {
    renderWorkspace({
      app: {
        ...createApplication(),
        profileReadiness: { state: "blocked", warnings: ["positioning", "evidence"] },
      },
    });

    expect(screen.getByText("Complete your profile first")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit profile" })).toHaveAttribute("href", "/profile");
    expect(screen.getByRole("button", { name: "Update pack" })).toBeDisabled();
  });
});

function renderWorkspace({
  app = createApplication(),
  profile = createProfile(),
  onUpdate = vi.fn(async () => undefined),
  onResolveDocumentUrl = vi.fn(async (documentId: string) => `https://files/${documentId}`),
}: {
  app?: JobApplication;
  profile?: ApiProfile;
  onUpdate?: (
    content: ApiDocumentContent,
    preferences: ApiApplicationPackPreferences,
  ) => Promise<void>;
  onResolveDocumentUrl?: (documentId: string) => Promise<string>;
} = {}) {
  return render(
    <MemoryRouter>
      <ApplicationPackWorkspace
        app={app}
        downloadingId={null}
        isUpdating={false}
        onDownload={vi.fn(async () => undefined)}
        onResolveDocumentUrl={onResolveDocumentUrl}
        onUpdate={onUpdate}
        profile={profile}
        templates={[]}
      />
    </MemoryRouter>,
  );
}

function createProfile(): ApiProfile {
  return {
    autoGenerateDocuments: true,
    autoRunMatchAnalysis: true,
    certifications: ["Azure Fundamentals"],
    createdAt: "2026-07-14T00:00:00.000Z",
    education: [
      {
        degree: "BSc",
        field: "Computer Science",
        institution: "Example University",
        startDate: "2018",
        endDate: "2022",
      },
    ],
    email: "ada@example.com",
    experience: [
      {
        company: "Acme",
        description: "Original product experience",
        startDate: "2022",
        title: "Product Engineer",
      },
    ],
    followUpRemindersEnabled: true,
    fullName: "Ada Lovelace",
    headline: "Product Engineer",
    id: "profile-1",
    links: ["https://ada.example.com"],
    location: "Remote",
    projects: [
      {
        achievements: ["Designed the compiler"],
        description: "Built a computing model",
        name: "Analytical Engine",
        skills: ["Mathematics"],
        url: "https://ada.example.com/engine",
      },
    ],
    skills: ["React", "TypeScript"],
    summary: "Product engineer.",
    updatedAt: "2026-07-14T00:00:00.000Z",
  };
}

function createApplication(): JobApplication {
  const customizedSummary = paragraph("Tailored product engineer summary.");
  const coverLetterContent = paragraph("I would be glad to help Acme ship its product.");

  return {
    aiMatch: {
      bulletOptimizations: [],
      currentSummary: "Product engineer.",
      enhancedSummary: "Tailored product engineer summary.",
      keywords: [{ keyword: "React", match: true }],
      recommendation: "Strong match with relevant product experience.",
      requirements: [
        {
          evidence: ["Shipped React products"],
          requirement: "React",
          status: "matched",
        },
      ],
      score: 86,
      suggestedSkills: [],
      summary: "Your strongest evidence aligns with the role's product focus.",
      yourSkills: ["React"],
    },
    applicationPackPreferences: { language: "auto", tone: "professional" },
    company: "Acme",
    dateApplied: "Jul 14, 2026",
    dateLabel: "Today",
    documentContent: {
      certificationSuggestions: ["AWS Practitioner"],
      coverLetterContent,
      customizedSummary,
      formatVersion: 2,
      educationEnhancements: [
        {
          achievements: [],
          description: paragraph(
            "Relevant computer science coursework. Completed systems research.",
          ),
          educationIndex: 0,
        },
      ],
      experienceEnhancements: [
        {
          achievements: [],
          description: paragraph("Built product experiences. Shipped React products."),
          experienceIndex: 0,
        },
      ],
      projectEnhancements: [
        {
          achievements: [],
          description: paragraph("Tailored project evidence. Improved the compiler design."),
          projectIndex: 0,
        },
      ],
      selections: {
        certifications: "ai",
        customizedSummary: "ai",
        education: {},
        experience: {},
        projects: {},
        skills: "ai",
      },
      skillSuggestions: ["React"],
    },
    domain: "linkedin.com",
    generatedDocuments: [
      { createdAt: "Today", format: "docx", id: "cv-docx", kind: "cv", name: "cv.docx" },
      { createdAt: "Today", format: "pdf", id: "cv-pdf", kind: "cv", name: "cv.pdf" },
      {
        createdAt: "Today",
        format: "docx",
        id: "cover-docx",
        kind: "cover_letter",
        name: "cover-letter.docx",
      },
      {
        createdAt: "Today",
        format: "pdf",
        id: "cover-pdf",
        kind: "cover_letter",
        name: "cover-letter.pdf",
      },
    ],
    id: "job-1",
    location: "Remote",
    processingStatus: "completed",
    profileReadiness: { state: "ready", warnings: [] },
    role: "Product Engineer",
    status: "Saved",
    tags: [],
  };
}

function paragraph(text: string): RichDocument {
  return {
    blocks: [{ type: "paragraph", children: [{ type: "text", text }] }],
    version: 1,
  };
}

function bulletList(text: string): RichDocument {
  return {
    blocks: [
      {
        items: [
          {
            blocks: [{ type: "paragraph", children: [{ type: "text", text }] }],
          },
        ],
        type: "bulletList",
      },
    ],
    version: 1,
  };
}

function richDocumentText(document: RichDocument): string {
  const values: string[] = [];

  function visit(value: unknown) {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;

    const record = value as Record<string, unknown>;
    if (typeof record.text === "string") values.push(record.text);
    Object.entries(record).forEach(([key, child]) => {
      if (key !== "text") visit(child);
    });
  }

  visit(document.blocks);
  return values.join(" ");
}
