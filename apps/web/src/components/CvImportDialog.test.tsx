import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "../api/client.js";
import type { ApiProfile, ApiProfileImportDraft } from "../api/types.js";
import { CvImportDialog, availableSections, selectDraftSections } from "./CvImportDialog";

vi.mock("../api/profiles.js", () => ({
  profilesApi: {
    extractFromCv: vi.fn(),
    applyCvImport: vi.fn(),
  },
}));

import { profilesApi } from "../api/profiles.js";

const draft: ApiProfileImportDraft = {
  fullName: "Ada Lovelace",
  headline: "Analyst",
  skillGroups: [{ name: "", skills: ["Mathematics", "Notation"] }],
  experience: [{ company: "Analytical Engines", title: "Analyst", startDate: "1842" }],
};

function renderDialog(onApplied = vi.fn(), onClose = vi.fn()) {
  render(
    <MemoryRouter>
      <CvImportDialog open onClose={onClose} onApplied={onApplied} />
    </MemoryRouter>,
  );
  return { onApplied, onClose };
}

function chooseFile(name = "cv.pdf") {
  fireEvent.change(screen.getByLabelText("CV file"), {
    target: { files: [new File(["%PDF-1.7"], name, { type: "application/pdf" })] },
  });
}

describe("CvImportDialog", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("reviews the extracted sections and applies only the ones kept", async () => {
    const profile = { id: "profile-1" } as ApiProfile;
    vi.mocked(profilesApi.extractFromCv).mockResolvedValue(draft);
    vi.mocked(profilesApi.applyCvImport).mockResolvedValue(profile);
    const { onApplied, onClose } = renderDialog();

    chooseFile();

    expect(await screen.findByText("Analyst · Analytical Engines (1842 – Present)")).toBeVisible();
    expect(screen.getByRole("note")).toHaveTextContent("read from your CV with AI");
    fireEvent.click(screen.getByRole("checkbox", { name: /Skills/ }));
    fireEvent.click(screen.getByRole("button", { name: "Apply to profile" }));

    await waitFor(() => expect(onApplied).toHaveBeenCalledWith(profile));
    expect(profilesApi.applyCvImport).toHaveBeenCalledWith({
      fullName: "Ada Lovelace",
      headline: "Analyst",
      experience: draft.experience,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("shows why a CV could not be read and lets the user try again", async () => {
    vi.mocked(profilesApi.extractFromCv).mockRejectedValue(
      new ApiError("We couldn't find any text in this CV.", 400, { code: "validation" }),
    );
    renderDialog();

    chooseFile();

    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't find any text");
    expect(screen.getByLabelText("CV file")).toBeInTheDocument();
  });

  it("points to AI provider setup when no provider is configured", async () => {
    vi.mocked(profilesApi.extractFromCv).mockRejectedValue(
      new ApiError("No AI provider", 409, { code: "ai_provider_not_configured" }),
    );
    renderDialog();

    chooseFile();

    expect(await screen.findByRole("alert")).toHaveTextContent("Add an AI provider");
  });
});

describe("selectDraftSections", () => {
  it("keeps basic fields together and drops unselected sections", () => {
    expect(availableSections(draft)).toEqual(["basics", "skillGroups", "experience"]);
    expect(selectDraftSections(draft, new Set(["basics"]))).toEqual({
      fullName: "Ada Lovelace",
      headline: "Analyst",
    });
  });
});
