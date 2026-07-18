import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { profilesApi } from "../api/profiles.js";
import type { ApiDocumentTemplate, ApiProfile } from "../api/types.js";
import TemplateManager from "./TemplateManager.js";

vi.mock("../api/profiles.js", () => ({
  profilesApi: {
    deleteDocumentTemplate: vi.fn(),
    listDocumentTemplates: vi.fn(),
    me: vi.fn(),
    setDefaultDocumentTemplate: vi.fn(),
    uploadDocumentTemplate: vi.fn(),
  },
}));

const profile = {
  id: "profile-1",
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  autoRunMatchAnalysis: true,
  links: [],
  skills: [],
  experience: [],
  education: [],
  certifications: [],
  projects: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} satisfies ApiProfile;

const cvTemplate = {
  id: "cv-template",
  profileId: "profile-1",
  kind: "cv",
  format: "docx",
  fileId: "cv-file",
  fileName: "cv.docx",
  contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  size: 128,
  placeholders: ["full_name"],
  fieldMappings: {},
  variableAliases: { fields: {} },
  isDefault: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} satisfies ApiDocumentTemplate;

describe("TemplateManager", () => {
  beforeEach(() => {
    vi.mocked(profilesApi.me).mockResolvedValue(profile);
    vi.mocked(profilesApi.listDocumentTemplates).mockResolvedValue([]);
    vi.mocked(profilesApi.deleteDocumentTemplate).mockResolvedValue();
    vi.mocked(profilesApi.uploadDocumentTemplate).mockImplementation(
      async (_profileId, kind, file) =>
        ({
          id: `${kind}-template`,
          profileId: "profile-1",
          kind,
          format: "docx",
          fileId: `${kind}-file`,
          fileName: file.name,
          contentType: file.type,
          size: file.size,
          placeholders: ["content"],
          fieldMappings: {},
          variableAliases: { fields: {} },
          isDefault: kind === "cv",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }) satisfies ApiDocumentTemplate,
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows separate CV and cover-letter DOCX uploads with explicit kinds", async () => {
    const { container } = render(<TemplateManager />);

    await screen.findByText("Upload CV template");
    expect(screen.getByText("Upload cover letter template")).toBeInTheDocument();

    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="file"]');
    expect(inputs).toHaveLength(2);
    expect(inputs[0]?.accept).toBe(".docx");
    expect(inputs[1]?.accept).toBe(".docx");

    const cvFile = new File(["cv"], "cv.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const coverLetterFile = new File(["letter"], "cover-letter.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    fireEvent.change(inputs[0]!, { target: { files: [cvFile] } });
    fireEvent.change(inputs[1]!, { target: { files: [coverLetterFile] } });

    await waitFor(() => {
      expect(profilesApi.uploadDocumentTemplate).toHaveBeenCalledWith("profile-1", "cv", cvFile);
      expect(profilesApi.uploadDocumentTemplate).toHaveBeenCalledWith(
        "profile-1",
        "cover_letter",
        coverLetterFile,
      );
    });
  });

  it("opens and closes variable mapping from the expandable row", async () => {
    vi.mocked(profilesApi.listDocumentTemplates).mockResolvedValue([cvTemplate]);
    render(<TemplateManager />);

    const editButton = await screen.findByRole("button", {
      name: "Edit variable mappings for cv.docx",
    });
    expect(screen.queryByRole("button", { name: "Delete template cv.docx" })).toBeNull();
    fireEvent.click(editButton);

    expect(screen.getByText("Full Name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete template cv.docx" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Close variable mappings for cv.docx" }),
    ).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: "Close variable mappings for cv.docx" }));
    expect(screen.queryByText("Full Name")).not.toBeInTheDocument();
  });

  it("confirms default-template deletion and removes the row", async () => {
    vi.mocked(profilesApi.listDocumentTemplates).mockResolvedValue([cvTemplate]);
    render(<TemplateManager />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Edit variable mappings for cv.docx" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete template cv.docx" }));

    expect(screen.getByRole("dialog", { name: "Delete cv.docx?" })).toBeInTheDocument();
    expect(screen.getByText(/saved selections will return to the default layout/i)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Delete template" }));

    await waitFor(() => {
      expect(profilesApi.deleteDocumentTemplate).toHaveBeenCalledWith("profile-1", "cv-template");
      expect(screen.queryByText("cv.docx")).not.toBeInTheDocument();
    });
    expect(screen.getByText("No cv templates yet.")).toBeInTheDocument();
  });

  it("cancels deletion without calling the API", async () => {
    vi.mocked(profilesApi.listDocumentTemplates).mockResolvedValue([cvTemplate]);
    render(<TemplateManager />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Edit variable mappings for cv.docx" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete template cv.docx" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Delete cv.docx?" })).not.toBeInTheDocument();
    });
    expect(profilesApi.deleteDocumentTemplate).not.toHaveBeenCalled();
    expect(screen.getByText("cv.docx")).toBeInTheDocument();
  });

  it("keeps the template and dialog visible when deletion fails", async () => {
    vi.mocked(profilesApi.listDocumentTemplates).mockResolvedValue([cvTemplate]);
    vi.mocked(profilesApi.deleteDocumentTemplate).mockRejectedValue(
      new Error("Storage cleanup unavailable"),
    );
    render(<TemplateManager />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Edit variable mappings for cv.docx" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete template cv.docx" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete template" }));

    expect(await screen.findByText("Storage cleanup unavailable")).toBeVisible();
    expect(screen.getByRole("dialog", { name: "Delete cv.docx?" })).toBeInTheDocument();
    expect(screen.getByText("cv.docx")).toBeInTheDocument();
  });
});
