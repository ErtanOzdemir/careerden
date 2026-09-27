import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
const rewriteCoverLetter = vi.fn();
const updateProfile = vi.fn();

vi.mock("../api/jobApplications.js", () => ({
  jobApplicationsApi: {
    applyFieldTip: (...args: unknown[]) => applyFieldTip(...args),
    rewriteCoverLetter: (...args: unknown[]) => rewriteCoverLetter(...args),
  },
}));

vi.mock("../api/profiles.js", () => ({
  profilesApi: { update: (...args: unknown[]) => updateProfile(...args) },
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
    rewriteCoverLetter.mockReset();
    updateProfile.mockReset();
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

    fireEvent.click(screen.getByRole("button", { name: /Mention shipping React products\./ }));

    await waitFor(() => expect(applyFieldTip).toHaveBeenCalledOnce());
    expect(applyFieldTip).toHaveBeenCalledWith("job-1", {
      field: { type: "experience", index: 0 },
      currentValue: paragraph("Built product experiences. Shipped React products."),
      tip: "Mention shipping React products.",
      requirement: "React",
      evidence: "Shipped React products",
    });

    const review = await screen.findByRole("region", { name: /Suggested change for/ });
    expect(review).toHaveTextContent("company-wide.");
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));

    fireEvent.click(screen.getByRole("button", { name: /Customize this pack/ }));
    fireEvent.click(screen.getByRole("button", { name: "Customize Experience" }));
    await waitFor(() =>
      expect(screen.getByText("Shipped React products company-wide.")).toBeInTheDocument(),
    );
  });

  it("leaves the draft untouched when a suggested tip change is discarded", async () => {
    renderPagedPreview.mockImplementation(() => pagedPreviewHandle(1));
    applyFieldTip.mockResolvedValue({ value: paragraph("Shipped React products company-wide.") });
    const onUpdate = vi.fn(async () => undefined);

    renderWorkspace({ onUpdate });

    fireEvent.click(screen.getByRole("button", { name: /Mention shipping React products\./ }));
    await screen.findByRole("region", { name: /Suggested change for/ });
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));

    expect(screen.queryByRole("region", { name: /Suggested change for/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Update pack" }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledOnce());
    const [savedContent] = onUpdate.mock.calls[0]! as unknown as [ApiDocumentContent];
    expect(savedContent.experienceEnhancements[0]?.description).toEqual(
      paragraph("Built product experiences. Shipped React products."),
    );
  });

  it("undoes an accepted tip change", async () => {
    renderPagedPreview.mockImplementation(() => pagedPreviewHandle(1));
    applyFieldTip.mockResolvedValue({ value: paragraph("Shipped React products company-wide.") });
    const onUpdate = vi.fn(async () => undefined);

    renderWorkspace({ onUpdate });

    fireEvent.click(screen.getByRole("button", { name: /Mention shipping React products\./ }));
    await screen.findByRole("region", { name: /Suggested change for/ });
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Update pack" }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledOnce());
    const [savedContent] = onUpdate.mock.calls[0]! as unknown as [ApiDocumentContent];
    expect(savedContent.experienceEnhancements[0]?.description).toEqual(
      paragraph("Built product experiences. Shipped React products."),
    );
  });

  it("adds a suggested skill only after the user confirms its name", async () => {
    renderPagedPreview.mockImplementation(() => pagedPreviewHandle(1));
    const onUpdate = vi.fn(async () => undefined);

    renderWorkspace({ onUpdate });

    fireEvent.click(screen.getByRole("button", { name: /Add Node\.js/ }));
    const form = screen.getByRole("form", { name: "Add to Skills" });
    expect(within(form).getByRole("textbox")).toHaveValue("Node.js");
    fireEvent.change(within(form).getByRole("textbox"), { target: { value: "Node.js 22" } });
    fireEvent.click(within(form).getByRole("button", { name: "Add" }));

    expect(screen.queryByRole("form", { name: "Add to Skills" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Update pack" }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledOnce());
    const [savedContent] = onUpdate.mock.calls[0]! as unknown as [ApiDocumentContent];
    expect(savedContent.skillSuggestions).toEqual(["React", "Node.js 22"]);
  });

  it("does not add a suggested skill when the confirmation is cancelled", async () => {
    renderPagedPreview.mockImplementation(() => pagedPreviewHandle(1));
    const onUpdate = vi.fn(async () => undefined);

    renderWorkspace({ onUpdate });

    fireEvent.click(screen.getByRole("button", { name: /Add Node\.js/ }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    fireEvent.click(screen.getByRole("button", { name: "Update pack" }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledOnce());
    const [savedContent] = onUpdate.mock.calls[0]! as unknown as [ApiDocumentContent];
    expect(savedContent.skillSuggestions).toEqual(["React"]);
  });

  it("applies every open tip for a field in one revision", async () => {
    renderPagedPreview.mockImplementation(() => pagedPreviewHandle(1));
    applyFieldTip.mockResolvedValue({ value: paragraph("Shipped React products at scale.") });
    const app = withAiMatch({
      experienceTips: [
        {
          index: 0,
          tips: [
            { text: "Mention shipping React products.", requirement: "React" },
            { text: "Lead with the product work." },
          ],
        },
      ],
    });

    renderWorkspace({ app });

    fireEvent.click(screen.getByRole("button", { name: "Apply all (2)" }));
    await screen.findByRole("region", { name: /Suggested change for Product Engineer/ });
    expect(applyFieldTip).toHaveBeenCalledWith("job-1", {
      field: { type: "experience", index: 0 },
      currentValue: paragraph("Built product experiences. Shipped React products."),
      tip: "Mention shipping React products.",
      requirement: "React",
      additionalTips: [{ tip: "Lead with the product work." }],
    });
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));

    expect(screen.getByRole("button", { name: /Mention shipping React products/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Lead with the product work/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Apply all/ })).not.toBeInTheDocument();
  });

  it("turns a gap-question answer into a CV change and optionally saves it to the profile", async () => {
    renderPagedPreview.mockImplementation(() => pagedPreviewHandle(1));
    const revised = paragraph("Built product experiences with GraphQL APIs.");
    applyFieldTip.mockResolvedValue({ value: revised });
    updateProfile.mockResolvedValue(createProfile());
    const onUpdate = vi.fn(async () => undefined);

    renderWorkspace({ onUpdate });

    fireEvent.change(screen.getByRole("textbox", { name: /Did you work with GraphQL/ }), {
      target: { value: "Yes, I built our GraphQL gateway." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Use answer" }));
    await screen.findByRole("region", { name: /Suggested change for/ });
    expect(applyFieldTip).toHaveBeenCalledWith("job-1", {
      field: { type: "experience", index: 0 },
      currentValue: paragraph("Built product experiences. Shipped React products."),
      tip: "Did you work with GraphQL at Acme?",
      requirement: "GraphQL APIs",
      candidateAnswer: "Yes, I built our GraphQL gateway.",
    });

    fireEvent.click(screen.getByRole("checkbox", { name: /Also save this to my profile/ }));
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));

    await waitFor(() => expect(updateProfile).toHaveBeenCalledOnce());
    expect(updateProfile).toHaveBeenCalledWith("profile-1", {
      experience: [
        {
          company: "Acme",
          description: "Built product experiences with GraphQL APIs.",
          descriptionRichText: revised,
          startDate: "2022",
          title: "Product Engineer",
        },
      ],
    });
    expect(screen.getByText("Added to your CV")).toBeInTheDocument();
    const saved = await saveDraft(onUpdate);
    expect(saved.experienceEnhancements[0]?.description).toEqual(revised);
  });

  it("does not touch the profile unless the user opts in", async () => {
    renderPagedPreview.mockImplementation(() => pagedPreviewHandle(1));
    applyFieldTip.mockResolvedValue({ value: paragraph("Built GraphQL APIs.") });

    renderWorkspace();

    fireEvent.change(screen.getByRole("textbox", { name: /Did you work with GraphQL/ }), {
      target: { value: "Yes." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Use answer" }));
    await screen.findByRole("region", { name: /Suggested change for/ });
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));

    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("rewrites the cover letter from the current draft after the user accepts it", async () => {
    renderPagedPreview.mockImplementation(() => pagedPreviewHandle(1));
    const letter = paragraph("I build React products and would love to do so at Acme.");
    rewriteCoverLetter.mockResolvedValue({ value: letter });
    const onUpdate = vi.fn(async () => undefined);

    renderWorkspace({ onUpdate });

    fireEvent.click(screen.getByRole("button", { name: "Rewrite from my CV" }));
    await screen.findByRole("region", { name: "Suggested change for Cover letter" });
    expect(rewriteCoverLetter).toHaveBeenCalledWith(
      "job-1",
      expect.objectContaining({ skillSuggestions: ["React"] }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));

    expect(screen.getByRole("button", { name: "Cover letter" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const saved = await saveDraft(onUpdate);
    expect(saved.coverLetterContent).toEqual(letter);
  });

  it("shows which job keywords the draft covers", () => {
    renderPagedPreview.mockImplementation(() => pagedPreviewHandle(1));

    renderWorkspace();

    const coverage = screen.getByRole("region", { name: "Keyword coverage" });
    expect(coverage).toHaveTextContent("1 of 2");
    expect(within(coverage).getByText("GraphQL")).toBeInTheDocument();
    expect(within(coverage).queryByText("React")).not.toBeInTheDocument();
  });

  it("reorders skills by relevance and can undo it", async () => {
    renderPagedPreview.mockImplementation(() => pagedPreviewHandle(1));
    const onUpdate = vi.fn(async () => undefined);

    renderWorkspace({
      app: withAiMatch({}, { skillSuggestions: ["Mathematics", "React", "GraphQL"] }),
      onUpdate,
    });

    fireEvent.click(screen.getByRole("button", { name: "Reorder skills" }));
    expect(screen.queryByRole("button", { name: "Reorder skills" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    fireEvent.click(screen.getByRole("button", { name: "Reorder skills" }));

    const saved = await saveDraft(onUpdate);
    expect(saved.skillSuggestions).toEqual(["React", "GraphQL", "Mathematics"]);
  });

  it("flags weak wording in the draft", () => {
    renderPagedPreview.mockImplementation(() => pagedPreviewHandle(1));

    renderWorkspace({
      app: withAiMatch(
        {},
        {
          experienceEnhancements: [
            {
              experienceIndex: 0,
              description: paragraph("Responsible for the checkout flow."),
            },
          ],
        },
      ),
    });

    expect(screen.getByRole("region", { name: "Writing checks" })).toHaveTextContent(
      "Uses “Responsible for” — lead with what you did or achieved instead.",
    );
  });

  it("warns when the CV runs past two pages", async () => {
    renderPagedPreview.mockImplementation(() => pagedPreviewHandle(3));

    renderWorkspace();

    expect(await screen.findByText("Most recruiters expect one or two pages")).toBeInTheDocument();
  });

  it("saves an accepted tip immediately and records it as applied", async () => {
    renderPagedPreview.mockImplementation(() => pagedPreviewHandle(1));
    const revised = paragraph("Shipped React products company-wide.");
    applyFieldTip.mockResolvedValue({ value: revised });
    const onSaveContent = vi.fn(async () => undefined);

    renderWorkspace({ onSaveContent });

    fireEvent.click(screen.getByRole("button", { name: /Mention shipping React products\./ }));
    await screen.findByRole("region", { name: /Suggested change for/ });
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));

    expect(onSaveContent).toHaveBeenCalledOnce();
    const [saved] = onSaveContent.mock.calls[0] as unknown as [ApiDocumentContent];
    expect(saved.experienceEnhancements[0]?.description).toEqual(revised);
    expect(saved.appliedTips).toEqual(["tip:experience-0:Mention shipping React products."]);
  });

  it("keeps previously accepted tips applied when the application is opened again", () => {
    renderPagedPreview.mockImplementation(() => pagedPreviewHandle(1));
    const app = withAiMatch(
      {
        experienceTips: [
          {
            index: 0,
            tips: [
              { text: "Mention shipping React products." },
              { text: "Lead with the product work." },
              { text: "Name the design system." },
            ],
          },
        ],
        gapQuestions: [
          {
            question: "Did you work with GraphQL at Acme?",
            field: { type: "experience", index: 0 },
          },
        ],
      },
      {
        appliedTips: [
          "tip:experience-0:Mention shipping React products.",
          "question:Did you work with GraphQL at Acme?",
        ],
      },
    );

    renderWorkspace({ app });

    expect(screen.getByRole("button", { name: /Mention shipping React products/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Lead with the product work/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Apply all (2)" })).toBeInTheDocument();
    expect(screen.getByText("Added to your CV")).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: /Did you work with GraphQL/ }),
    ).not.toBeInTheDocument();
  });

  it("saves the undo so the tip can be applied again", async () => {
    renderPagedPreview.mockImplementation(() => pagedPreviewHandle(1));
    applyFieldTip.mockResolvedValue({ value: paragraph("Shipped React products company-wide.") });
    const onSaveContent = vi.fn(async () => undefined);

    renderWorkspace({ onSaveContent });

    fireEvent.click(screen.getByRole("button", { name: /Mention shipping React products\./ }));
    await screen.findByRole("region", { name: /Suggested change for/ });
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(onSaveContent).toHaveBeenCalledTimes(2);
    const [saved] = onSaveContent.mock.calls[1] as unknown as [ApiDocumentContent];
    expect(saved.appliedTips).toEqual([]);
    expect(saved.experienceEnhancements[0]?.description).toEqual(
      paragraph("Built product experiences. Shipped React products."),
    );
    expect(screen.getByRole("button", { name: /Mention shipping React products/ })).toBeEnabled();
  });

  it("tells the user when an automatic save fails", async () => {
    renderPagedPreview.mockImplementation(() => pagedPreviewHandle(1));
    applyFieldTip.mockResolvedValue({ value: paragraph("Shipped React products company-wide.") });

    renderWorkspace({ onSaveContent: vi.fn(async () => Promise.reject(new Error("offline"))) });

    fireEvent.click(screen.getByRole("button", { name: /Mention shipping React products\./ }));
    await screen.findByRole("region", { name: /Suggested change for/ });
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));

    expect(
      await screen.findByText(
        "Couldn't save this change yet. It will be saved when you update the pack.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps unsaved edits when a refresh returns the same content", () => {
    renderPagedPreview.mockImplementation(() => pagedPreviewHandle(1));
    const app = withAiMatch({}, { skillSuggestions: ["Mathematics", "React"] });
    const workspace = (current: JobApplication) => (
      <MemoryRouter>
        <ApplicationPackWorkspace
          app={current}
          downloadingId={null}
          isUpdating={false}
          onDownload={vi.fn(async () => undefined)}
          onUpdate={vi.fn(async () => undefined)}
          profile={createProfile()}
          templates={HTML_TEMPLATES}
        />
      </MemoryRouter>
    );
    const view = render(workspace(app));

    fireEvent.click(screen.getByRole("button", { name: "Reorder skills" }));
    view.rerender(workspace(JSON.parse(JSON.stringify(app)) as JobApplication));

    expect(screen.queryByRole("button", { name: "Reorder skills" })).not.toBeInTheDocument();
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

function saveDraft(onUpdate: ReturnType<typeof vi.fn>) {
  fireEvent.click(screen.getByRole("button", { name: "Update pack" }));
  return waitFor(() => expect(onUpdate).toHaveBeenCalledOnce()).then(
    () => (onUpdate.mock.calls[0] as unknown as [ApiDocumentContent])[0],
  );
}

function withAiMatch(
  overrides: Partial<NonNullable<JobApplication["aiMatch"]>>,
  documentContent: Partial<ApiDocumentContent> = {},
): JobApplication {
  const app = createApplication();
  return {
    ...app,
    aiMatch: { ...app.aiMatch!, ...overrides },
    documentContent: { ...app.documentContent!, ...documentContent },
  };
}

function renderWorkspace({
  app = createApplication(),
  profile = createProfile(),
  templates = HTML_TEMPLATES,
  onUpdate = vi.fn(async () => undefined),
  onSaveContent,
}: {
  app?: JobApplication;
  profile?: ApiProfile;
  templates?: HtmlTemplateDefinition[];
  onUpdate?: (
    content: ApiDocumentContent,
    preferences: ApiApplicationPackPreferences,
  ) => Promise<void>;
  onSaveContent?: (content: ApiDocumentContent) => Promise<void>;
} = {}) {
  return render(
    <MemoryRouter>
      <ApplicationPackWorkspace
        app={app}
        downloadingId={null}
        isUpdating={false}
        onDownload={vi.fn(async () => undefined)}
        onSaveContent={onSaveContent}
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
      educationTips: [{ index: 0, tips: [{ text: "Mention the systems research." }] }],
      experienceTips: [
        {
          index: 0,
          tips: [
            {
              text: "Mention shipping React products.",
              requirement: "React",
              evidence: "Shipped React products",
            },
          ],
        },
      ],
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
      skillsTips: [{ item: "Node.js", text: "Add Node.js — it's used across the team." }],
      summary: "Your strongest evidence aligns with the role's product focus.",
      summaryTips: [{ text: "Lead with the React product work." }],
      gapQuestions: [
        {
          question: "Did you work with GraphQL at Acme?",
          requirement: "GraphQL APIs",
          field: { type: "experience", index: 0 },
        },
      ],
      keywords: ["React", "GraphQL"],
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
