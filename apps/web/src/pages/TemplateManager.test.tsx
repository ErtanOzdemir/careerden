import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { profilesApi } from "../api/profiles.js";
import type { ApiDocumentTemplate, ApiProfile } from "../api/types.js";
import TemplateManager from "./TemplateManager.js";

vi.mock("../api/profiles.js", () => ({
  profilesApi: {
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

describe("TemplateManager", () => {
  beforeEach(() => {
    vi.mocked(profilesApi.me).mockResolvedValue(profile);
    vi.mocked(profilesApi.listDocumentTemplates).mockResolvedValue([]);
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
});
