import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HTML_TEMPLATES } from "@careerden/contracts";
import type { HtmlTemplateDefinition } from "@careerden/contracts";
import type {
  ApiApplicationPackPreferences,
  ApiDocumentContent,
  ApiProfile,
  RichDocument,
} from "../api/types.js";
import type { JobApplication } from "../types.js";
import { ApplicationPackWorkspace } from "./ApplicationPackWorkspace.js";

interface FakePagedPreviewHandle {
  result: Promise<{ totalPages: number }>;
  cancel: () => void;
  highlightField: (domId: string) => void;
}

const renderPagedPreview =
  vi.fn<(html: string, container: HTMLElement) => FakePagedPreviewHandle>();

vi.mock("../lib/paged-preview.js", () => ({
  renderPagedPreview: (html: string, container: HTMLElement) => renderPagedPreview(html, container),
}));

function pagedPreviewHandle(totalPages: number): FakePagedPreviewHandle {
  return { result: Promise.resolve({ totalPages }), cancel: vi.fn(), highlightField: vi.fn() };
}

const applyFieldTip = vi.fn();

vi.mock("../api/jobApplications.js", () => ({
  jobApplicationsApi: { applyFieldTip: (...args: unknown[]) => applyFieldTip(...args) },
}));

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
  afterEach(() => {
    cleanup();
    renderPagedPreview.mockReset();
    applyFieldTip.mockReset();
  });

  it("presents the CV and cover letter as one ready application pack, paginated via Paged.js", async () => {
    renderPagedPreview.mockImplementation((html, container) => {
      container.innerHTML = '<iframe title="paged preview"></iframe>';
      return pagedPreviewHandle(1);
    });

    renderWorkspace();

    expect(screen.getByRole("heading", { name: "Application pack" })).toBeInTheDocument();
    expect(screen.getByText("Role match")).toBeInTheDocument();
    expect(screen.getByText("86%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tailored CV" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cover letter" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download both PDFs" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Live preview" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Server preview" })).not.toBeInTheDocument();

    await waitFor(() => expect(renderPagedPreview).toHaveBeenCalled());
    expect(renderPagedPreview.mock.calls[0]?.[0]).toContain("Ada Lovelace");
    await waitFor(() => expect(screen.getByText("1 page")).toBeInTheDocument());

    renderPagedPreview.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Cover letter" }));

    await waitFor(() => expect(renderPagedPreview).toHaveBeenCalled());
    expect(renderPagedPreview.mock.calls[0]?.[0]).toContain(
      "I would be glad to help Acme ship its product.",
    );
  });

  it("zooms the preview page with buttons and with ctrl+wheel", () => {
    renderPagedPreview.mockImplementation(() => pagedPreviewHandle(1));
    renderWorkspace();

    expect(screen.getByText("100%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByText("110%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(screen.getByText("90%")).toBeInTheDocument();

    const scrollArea = screen.getByTestId("preview-scroll-area");
    fireEvent.wheel(scrollArea, { ctrlKey: true, deltaY: -100 });
    expect(screen.getByText("105%")).toBeInTheDocument();

    // A plain wheel (no ctrl/cmd) scrolls the page instead of zooming.
    fireEvent.wheel(scrollArea, { deltaY: 100 });
    expect(screen.getByText("105%")).toBeInTheDocument();
  });

  it("shows every customizable section and updates the complete draft through one action", async () => {
    renderPagedPreview.mockImplementation(() => pagedPreviewHandle(1));
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
    fireEvent.click(screen.getByRole("button", { name: "Format Edit CV summary as bullet list" }));

    fireEvent.click(screen.getByRole("button", { name: "Customize Experience" }));
    expect(
      screen.getByText("Built product experiences. Shipped React products."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Customize Education" }));
    expect(
      screen.getByText("Relevant computer science coursework. Completed systems research."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Customize Projects" }));
    expect(
      screen.getByText("Tailored project evidence. Improved the compiler design."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Customize Skills" }));
    fireEvent.change(screen.getByLabelText("New skill"), { target: { value: "Node.js" } });
    fireEvent.click(screen.getByRole("button", { name: "Add skill" }));

    fireEvent.click(screen.getByRole("button", { name: "Customize Certifications" }));
    expect(screen.getByText("AWS Practitioner")).toBeInTheDocument();

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
      }),
      { language: "tr", tone: "concise" },
    );
    const [savedContent] = onUpdate.mock.calls[0]!;
    expect(savedContent).not.toHaveProperty("selections");
  });

  it("applies a tip from the tips panel to the matching field and highlights it in the preview", async () => {
    renderPagedPreview.mockImplementation(() => pagedPreviewHandle(1));
    applyFieldTip.mockResolvedValue({ value: paragraph("Shipped React products company-wide.") });

    renderWorkspace();

    fireEvent.click(
      screen.getByRole("button", { name: "Mention shipping React products." }),
    );

    await waitFor(() => expect(applyFieldTip).toHaveBeenCalledOnce());
    expect(applyFieldTip).toHaveBeenCalledWith("job-1", {
      field: { type: "experience", index: 0 },
      currentValue: paragraph("Built product experiences. Shipped React products."),
      tip: "Mention shipping React products.",
    });

    fireEvent.click(screen.getByRole("button", { name: /Customize this pack/ }));
    fireEvent.click(screen.getByRole("button", { name: "Customize Experience" }));
    await waitFor(() =>
      expect(screen.getByText("Shipped React products company-wide.")).toBeInTheDocument(),
    );
  });

  it("blocks generation when the profile is not ready", () => {
    renderPagedPreview.mockImplementation(() => pagedPreviewHandle(1));
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
  templates = HTML_TEMPLATES,
  onUpdate = vi.fn(async () => undefined),
}: {
  app?: JobApplication;
  profile?: ApiProfile;
  templates?: HtmlTemplateDefinition[];
  onUpdate?: (
    content: ApiDocumentContent,
    preferences: ApiApplicationPackPreferences,
  ) => Promise<void>;
} = {}) {
  return render(
    <MemoryRouter>
      <ApplicationPackWorkspace
        app={app}
        downloadingId={null}
        isUpdating={false}
        onDownload={vi.fn(async () => undefined)}
        onUpdate={onUpdate}
        profile={profile}
        templates={templates}
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
      certificationsTips: [],
      educationTips: [{ index: 0, tips: ["Mention the systems research."] }],
      experienceTips: [{ index: 0, tips: ["Mention shipping React products."] }],
      projectTips: [],
      recommendation: "Strong match with relevant product experience.",
      requirements: [
        {
          evidence: ["Shipped React products"],
          requirement: "React",
          status: "matched",
        },
      ],
      score: 86,
      skillsTips: ["Add Node.js — it's used across the team."],
      summary: "Your strongest evidence aligns with the role's product focus.",
      summaryTips: ["Lead with the React product work."],
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
          description: paragraph(
            "Relevant computer science coursework. Completed systems research.",
          ),
          educationIndex: 0,
        },
      ],
      experienceEnhancements: [
        {
          description: paragraph("Built product experiences. Shipped React products."),
          experienceIndex: 0,
        },
      ],
      projectEnhancements: [
        {
          description: paragraph("Tailored project evidence. Improved the compiler design."),
          projectIndex: 0,
        },
      ],
      skillSuggestions: ["React"],
    },
    domain: "linkedin.com",
    generatedDocuments: [
      { createdAt: "Today", format: "pdf", id: "cv-pdf", kind: "cv", name: "cv.pdf" },
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
