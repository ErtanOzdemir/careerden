import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProfileManager from "./ProfileManager.js";
import type { ApiProfile, RichDocument } from "../api/types.js";

vi.mock("../api/profiles.js", () => ({
  profilesApi: {
    me: vi.fn(),
    update: vi.fn(),
  },
}));

import { profilesApi } from "../api/profiles.js";

describe("ProfileManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows profile cards as text and edits basic information as one partial save", async () => {
    const richText = createRichText();
    const profile = createProfile(richText);
    vi.mocked(profilesApi.me).mockResolvedValue(profile);
    vi.mocked(profilesApi.update).mockResolvedValue(profile);

    render(<ProfileManager />);

    expect((await screen.findAllByText("Ada Lovelace")).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Full name")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Professional summary")).toBeInTheDocument();
    expect(screen.getByLabelText("Engineer description")).toBeInTheDocument();
    expect(screen.getByLabelText("Link2CV description")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit basic information" }));
    expect(screen.getByLabelText("Full name")).toHaveValue("Ada Lovelace");
    fireEvent.change(screen.getByLabelText("Headline"), {
      target: { value: "Computing pioneer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save basic information" }));

    await waitFor(() => {
      expect(profilesApi.update).toHaveBeenCalledWith("profile-1", {
        fullName: "Ada Lovelace",
        email: "ada@example.com",
        profession: "",
        location: "",
        headline: "Computing pioneer",
      });
    });
  });

  it("edits and saves the professional summary independently", async () => {
    const richText = createRichText();
    const profile = createProfile(richText);
    vi.mocked(profilesApi.me).mockResolvedValue(profile);
    vi.mocked(profilesApi.update).mockResolvedValue(profile);

    render(<ProfileManager />);

    expect(await screen.findByLabelText("Professional summary")).toBeInTheDocument();
    expect(screen.queryByLabelText("Summary")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit professional summary" }));
    expect(screen.getByLabelText("Summary")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save professional summary" }));

    await waitFor(() => {
      expect(profilesApi.update).toHaveBeenCalledWith("profile-1", {
        summaryRichText: richText,
      });
    });
  });
});

function createRichText(): RichDocument {
  return {
    version: 1,
    blocks: [
      {
        type: "paragraph",
        children: [{ type: "text", text: "Built reliable systems", marks: [{ type: "bold" }] }],
      },
    ],
  };
}

function createProfile(richText: RichDocument): ApiProfile {
  return {
    id: "profile-1",
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    autoRunMatchAnalysis: true,
    followUpRemindersEnabled: true,
    certifications: [],
    createdAt: "2026-07-13T00:00:00.000Z",
    education: [],
    experience: [
      {
        company: "Analytical Engines",
        title: "Engineer",
        description: "Built reliable systems",
        descriptionRichText: richText,
      },
    ],
    links: [],
    projects: [
      {
        name: "Link2CV",
        description: "Built reliable systems",
        descriptionRichText: richText,
        skills: [],
        achievements: [],
      },
    ],
    skills: [],
    summary: "Built reliable systems",
    summaryRichText: richText,
    updatedAt: "2026-07-13T00:00:00.000Z",
  };
}
