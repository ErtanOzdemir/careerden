import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import TemplateVariableMapping from "./TemplateVariableMapping.js";
import { profilesApi } from "../api/profiles.js";
import type { ApiDocumentTemplate, ApiProfile } from "../api/types.js";

vi.mock("../api/profiles.js", () => ({
  profilesApi: {
    updateDocumentTemplateMappings: vi.fn(),
    updateDocumentTemplateVariableAliases: vi.fn(),
  },
}));

const mockProfile: ApiProfile = {
  id: "profile-1",
  fullName: "John Doe",
  email: "john@example.com",
  autoRunMatchAnalysis: true,
  profession: "Software Engineer",
  headline: "Senior Developer",
  location: "New York",
  summary: "Experienced engineer with 10 years in web development",
  skills: ["React", "TypeScript", "Node.js"],
  experience: [
    {
      title: "Senior Developer",
      company: "Acme Corp",
      startDate: "2022-01",
      endDate: "2025-01",
      description: "Led frontend team",
    },
    {
      title: "Junior Developer",
      company: "Startup Inc",
      startDate: "2019-01",
      endDate: "2021-12",
      description: "Built internal tools",
    },
  ],
  education: [
    {
      institution: "MIT",
      degree: "BSc Computer Science",
      field: "Computer Science",
      startDate: "2015-09",
      endDate: "2019-06",
    },
  ],
  links: ["https://github.com/john", "https://linkedin.com/in/john"],
  certifications: ["AWS Certified"],
  projects: [
    {
      name: "Portfolio",
      description: "Personal site",
      url: "https://example.com",
      skills: ["React"],
      achievements: ["Launched redesign"],
    },
  ],
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

const mockTemplate: ApiDocumentTemplate = {
  id: "template-1",
  profileId: "profile-1",
  kind: "cv",
  format: "docx",
  fileId: "file-1",
  fileName: "my-cv.docx",
  contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  size: 45000,
  placeholders: ["full_name", "email", "profession", "intro", "footer"],
  fieldMappings: {},
  variableAliases: { fields: {} },
  isDefault: true,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("TemplateVariableMapping", () => {
  it("maps only cover letter Content and removes obsolete extra mappings", async () => {
    const coverLetterTemplate: ApiDocumentTemplate = {
      ...mockTemplate,
      kind: "cover_letter",
      fileName: "cover-letter.docx",
      placeholders: ["letter_body", "footer"],
      fieldMappings: {
        letter_body: "cover_letter_content",
        footer: "full_name",
      },
      variableAliases: { fields: { email: "footer" } },
      isDefault: false,
    };
    const updated = {
      ...coverLetterTemplate,
      fieldMappings: { letter_body: "cover_letter_content" as const },
      variableAliases: { fields: {} },
    };
    (profilesApi.updateDocumentTemplateMappings as ReturnType<typeof vi.fn>).mockResolvedValue(
      updated,
    );
    (
      profilesApi.updateDocumentTemplateVariableAliases as ReturnType<typeof vi.fn>
    ).mockResolvedValue(updated);
    const onUpdated = vi.fn();

    render(
      <TemplateVariableMapping
        template={coverLetterTemplate}
        profile={mockProfile}
        onUpdated={onUpdated}
      />,
    );

    expect(screen.getByText("Content")).toBeDefined();
    expect(screen.queryByText("Full Name")).toBeNull();
    expect(screen.queryByText("Target Company")).toBeNull();
    expect(screen.queryByText("Selected Experiences")).toBeNull();
    expect(
      screen.getByText(
        "Content supports rich formatting, so its DOCX placeholder must be the only text in its paragraph.",
      ),
    ).toBeDefined();
    fireEvent.click(screen.getByText("Save Mapping").closest("button")!);

    await waitFor(() => {
      expect(profilesApi.updateDocumentTemplateMappings).toHaveBeenCalledWith(
        "profile-1",
        "template-1",
        { letter_body: "cover_letter_content" },
      );
    });
    expect(profilesApi.updateDocumentTemplateVariableAliases).toHaveBeenCalledWith(
      "profile-1",
      "template-1",
      { fields: {} },
    );
    expect(onUpdated).toHaveBeenCalledWith(updated);
  });

  it("renders all flat fields with dropdowns", () => {
    render(<TemplateVariableMapping template={mockTemplate} profile={mockProfile} />);

    expect(screen.getByText("Full Name")).toBeDefined();
    expect(screen.getByText("Email")).toBeDefined();
    expect(screen.getByText("Profession")).toBeDefined();
    expect(screen.getByText("Summary")).toBeDefined();
    expect(screen.getByText("Skills")).toBeDefined();
    expect(screen.getAllByText("Links").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Selected Experiences").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Selected Education").length).toBeGreaterThanOrEqual(1);
  });

  it("shows field value previews from profile data", () => {
    render(<TemplateVariableMapping template={mockTemplate} profile={mockProfile} />);

    expect(screen.getByText("John Doe")).toBeDefined();
    expect(screen.getByText("john@example.com")).toBeDefined();
    expect(screen.getByText("Software Engineer")).toBeDefined();
  });

  it("shows no variables message when template has zero placeholders", () => {
    const emptyTemplate = { ...mockTemplate, placeholders: [] };
    render(<TemplateVariableMapping template={emptyTemplate} profile={mockProfile} />);

    expect(screen.getByText("No variables detected in this template.")).toBeDefined();
  });

  it("shows unmapped placeholder warning", () => {
    render(<TemplateVariableMapping template={mockTemplate} profile={mockProfile} />);

    expect(screen.getByText("Unmapped:")).toBeDefined();
    expect(screen.getByText("{{full_name}}")).toBeDefined();
    expect(screen.getByText("{{email}}")).toBeDefined();
    expect(screen.getByText("{{intro}}")).toBeDefined();
  });

  it("save button is disabled when no changes made", () => {
    render(<TemplateVariableMapping template={mockTemplate} profile={mockProfile} />);

    const saveButton = screen.getByText("Save Mapping").closest("button");
    expect(saveButton).toBeDisabled();
  });

  it("enables save button when a mapping is changed", async () => {
    render(<TemplateVariableMapping template={mockTemplate} profile={mockProfile} />);

    const unmappedDropdowns = screen.getAllByText("Unmapped");
    fireEvent.click(unmappedDropdowns[0]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "{{full_name}}" })).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: "{{full_name}}" }));

    await waitFor(() => {
      const saveButton = screen.getByText("Save Mapping").closest("button");
      expect(saveButton).not.toBeDisabled();
    });
  });

  it("calls both API endpoints on save with correct data", async () => {
    const mappedTemplate = {
      ...mockTemplate,
      fieldMappings: {
        full_name: "full_name",
        email: "email",
      },
      variableAliases: {
        fields: {},
        selectedExperiences: {
          fields: {},
          items: [{ fields: { title: "exp1_title", company: "exp1_company" } }],
        },
      },
    };

    (profilesApi.updateDocumentTemplateMappings as ReturnType<typeof vi.fn>).mockResolvedValue(
      mappedTemplate,
    );
    (
      profilesApi.updateDocumentTemplateVariableAliases as ReturnType<typeof vi.fn>
    ).mockResolvedValue(mappedTemplate);

    render(<TemplateVariableMapping template={mappedTemplate} profile={mockProfile} />);

    const unmappedDropdowns = screen.getAllByText("Unmapped");
    fireEvent.click(unmappedDropdowns[0]);
    const option = screen.getByRole("button", { name: "{{profession}}" });
    fireEvent.click(option);

    await waitFor(() => {
      const saveButton = screen.getByText("Save Mapping").closest("button");
      expect(saveButton).not.toBeDisabled();
    });

    fireEvent.click(screen.getByText("Save Mapping").closest("button")!);

    await waitFor(() => {
      expect(profilesApi.updateDocumentTemplateMappings).toHaveBeenCalled();
      expect(profilesApi.updateDocumentTemplateVariableAliases).toHaveBeenCalled();
    });
  });

  it("shows error message when mappings save fails", async () => {
    (profilesApi.updateDocumentTemplateMappings as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error"),
    );

    render(<TemplateVariableMapping template={mockTemplate} profile={mockProfile} />);

    const unmappedDropdowns = screen.getAllByText("Unmapped");
    fireEvent.click(unmappedDropdowns[0]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "{{full_name}}" })).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: "{{full_name}}" }));

    await waitFor(() => {
      expect(screen.getByText("Save Mapping").closest("button")).not.toBeDisabled();
    });

    fireEvent.click(screen.getByText("Save Mapping").closest("button")!);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeDefined();
    });
  });

  it("expands and collapses experience mapping group", async () => {
    render(<TemplateVariableMapping template={mockTemplate} profile={mockProfile} />);

    const expToggle = screen.getByRole("button", { name: /Selected Experiences/ });
    expect(expToggle).toBeDefined();

    fireEvent.click(expToggle);

    await waitFor(() => {
      expect(screen.getByText("Experience 1")).toBeDefined();
      expect(screen.getByText("Experience 2")).toBeDefined();
    });

    fireEvent.click(expToggle);

    await waitFor(() => {
      expect(screen.queryByText("Experience 1")).toBeNull();
    });
  });

  it("shows selected experience date and period previews", async () => {
    render(<TemplateVariableMapping template={mockTemplate} profile={mockProfile} />);

    fireEvent.click(screen.getByRole("button", { name: /Selected Experiences/ }));

    await waitFor(() => {
      expect(screen.getByText("2022-01")).toBeDefined();
      expect(screen.getByText("2025-01")).toBeDefined();
      expect(screen.getByText("2022-01 - 2025-01")).toBeDefined();
    });
  });

  it("does not expose selected experience skills or achievements mappings", async () => {
    render(<TemplateVariableMapping template={mockTemplate} profile={mockProfile} />);

    fireEvent.click(screen.getByRole("button", { name: /Selected Experiences/ }));

    await waitFor(() => {
      expect(screen.getByText("Experience 1")).toBeDefined();
    });

    expect(screen.queryByText("Achievements")).toBeNull();
    expect(screen.queryByText("React, TypeScript")).toBeNull();
  });

  it("shows selected education date, period, and description mapping", async () => {
    render(<TemplateVariableMapping template={mockTemplate} profile={mockProfile} />);

    fireEvent.click(screen.getByRole("button", { name: /Selected Education/ }));

    await waitFor(() => {
      expect(screen.getByText("2015-09")).toBeDefined();
      expect(screen.getByText("2019-06")).toBeDefined();
      expect(screen.getByText("2015-09 - 2019-06")).toBeDefined();
      expect(screen.getByText("Description")).toBeDefined();
      expect(screen.getByText("Tailored education details")).toBeDefined();
    });
  });

  it("does not expose selected education achievements mappings", async () => {
    render(<TemplateVariableMapping template={mockTemplate} profile={mockProfile} />);

    fireEvent.click(screen.getByRole("button", { name: /Selected Education/ }));

    await waitFor(() => {
      expect(screen.getByText("Education 1")).toBeDefined();
    });

    expect(screen.queryByText("Achievements")).toBeNull();
  });

  it("does not expose selected project skills or achievements mappings", async () => {
    render(<TemplateVariableMapping template={mockTemplate} profile={mockProfile} />);

    fireEvent.click(screen.getByRole("button", { name: /Selected Projects/ }));

    await waitFor(() => {
      expect(screen.getByText("Project 1")).toBeDefined();
    });

    expect(screen.queryByText("React")).toBeNull();
    expect(screen.queryByText("Launched redesign")).toBeNull();
  });

  it("drops stale selected experience, education, and project aliases before saving", async () => {
    const mappedTemplate = {
      ...mockTemplate,
      variableAliases: {
        fields: {},
        selectedExperiences: {
          fields: {},
          items: [
            {
              fields: {
                achievements: "exp_achievements",
                skills: "exp_skills",
                title: "exp_title",
              },
            },
          ],
        },
        selectedEducation: {
          fields: {},
          items: [
            {
              fields: {
                achievements: "education_achievements",
                institution: "school_name",
              },
            },
          ],
        },
        selectedProjects: {
          fields: {},
          items: [
            {
              fields: {
                achievements: "project_achievements",
                skills: "project_skills",
                name: "project_name",
              },
            },
          ],
        },
      },
    } satisfies ApiDocumentTemplate;

    (profilesApi.updateDocumentTemplateMappings as ReturnType<typeof vi.fn>).mockResolvedValue(
      mappedTemplate,
    );
    (
      profilesApi.updateDocumentTemplateVariableAliases as ReturnType<typeof vi.fn>
    ).mockResolvedValue(mappedTemplate);

    render(<TemplateVariableMapping template={mappedTemplate} profile={mockProfile} />);

    fireEvent.click(screen.getByRole("button", { name: /Selected Experiences/ }));
    await waitFor(() => {
      expect(screen.getByText("Experience 1")).toBeDefined();
    });

    const expTitleDropdown = screen.getByRole("button", { name: "{{exp_title}}" });
    fireEvent.click(expTitleDropdown);
    fireEvent.click(screen.getByRole("button", { name: "{{full_name}}" }));

    fireEvent.click(screen.getByText("Save Mapping").closest("button")!);

    await waitFor(() => {
      expect(profilesApi.updateDocumentTemplateVariableAliases).toHaveBeenCalled();
    });

    expect(profilesApi.updateDocumentTemplateVariableAliases).toHaveBeenCalledWith(
      mappedTemplate.profileId,
      mappedTemplate.id,
      expect.objectContaining({
        selectedExperiences: {
          fields: {},
          items: [{ fields: { title: "full_name" } }],
        },
        selectedEducation: {
          fields: {},
          items: [{ fields: { institution: "school_name" } }],
        },
        selectedProjects: {
          fields: {},
          items: [{ fields: { name: "project_name" } }],
        },
      }),
    );
  });

  it("shows 0 items badge when profile has no experiences", () => {
    const emptyProfile = { ...mockProfile, experience: [] };
    render(<TemplateVariableMapping template={mockTemplate} profile={emptyProfile} />);

    const items = screen.getAllByText("(0 items)");
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it("shows 0 items badge when profile has no education", () => {
    const emptyProfile = { ...mockProfile, education: [] };
    render(<TemplateVariableMapping template={mockTemplate} profile={emptyProfile} />);

    const eduItems = screen.getAllByText("(0 items)");
    expect(eduItems.length).toBeGreaterThanOrEqual(1);
  });
});
