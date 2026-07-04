import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Settings from "./Settings";

vi.mock("../api/profiles.js", () => ({
  profilesApi: {
    me: vi.fn(),
    update: vi.fn(),
  },
}));

import { profilesApi } from "../api/profiles.js";
import type { ApiProfile } from "../api/types.js";

describe("Settings", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("loads account details from the profile and removes unused processing preferences", async () => {
    vi.mocked(profilesApi.me).mockResolvedValue(createProfile());

    render(<Settings />);

    expect(await screen.findByDisplayValue("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByDisplayValue("ada@example.com")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Auto-run match analysis" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.queryByText("Auto-generate documents")).not.toBeInTheDocument();
    expect(screen.queryByText("Save drafts before applying")).not.toBeInTheDocument();
  });

  it("saves auto-run match analysis preference changes", async () => {
    const profile = createProfile();
    vi.mocked(profilesApi.me).mockResolvedValue(profile);
    vi.mocked(profilesApi.update).mockResolvedValue({ ...profile, autoRunMatchAnalysis: false });

    render(<Settings />);

    const toggle = await screen.findByRole("switch", { name: "Auto-run match analysis" });
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(profilesApi.update).toHaveBeenCalledWith("profile-1", {
        autoRunMatchAnalysis: false,
      });
    });
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });
});

function createProfile(overrides: Partial<ApiProfile> = {}): ApiProfile {
  return {
    id: "profile-1",
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    autoRunMatchAnalysis: true,
    certifications: [],
    createdAt: "2026-07-04T00:00:00.000Z",
    education: [],
    experience: [],
    links: [],
    projects: [],
    skills: [],
    updatedAt: "2026-07-04T00:00:00.000Z",
    ...overrides,
  };
}
