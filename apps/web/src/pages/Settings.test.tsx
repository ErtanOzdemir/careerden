import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Settings from "./Settings";
import { THEME_STORAGE_KEY } from "../theme.js";

vi.mock("../api/profiles.js", () => ({
  profilesApi: {
    me: vi.fn(),
    update: vi.fn(),
  },
}));

import { profilesApi } from "../api/profiles.js";
import type { ApiProfile } from "../api/types.js";

describe("Settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    document.documentElement.classList.remove("light", "dark");
    delete window.electronAPI;
  });

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

  it("synchronizes every theme selection with storage, renderer classes, and Electron", async () => {
    vi.mocked(profilesApi.me).mockResolvedValue(createProfile());
    const setNativeThemeSource = installElectronApi();

    render(<Settings />);
    await screen.findByDisplayValue("Ada Lovelace");

    for (const theme of ["light", "dark", "system"] as const) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(theme, "i") }));

      expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe(theme);
      expect(document.documentElement.classList.contains("light")).toBe(theme === "light");
      expect(document.documentElement.classList.contains("dark")).toBe(theme === "dark");
      expect(screen.getByRole("button", { name: new RegExp(theme, "i") })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(setNativeThemeSource).toHaveBeenLastCalledWith(theme);
    }
  });

  it("applies theme selections in a browser without an Electron bridge", async () => {
    vi.mocked(profilesApi.me).mockResolvedValue(createProfile());

    render(<Settings />);
    await screen.findByDisplayValue("Ada Lovelace");
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement).toHaveClass("dark");
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
  });

  it("synchronizes cross-window theme storage changes", async () => {
    vi.mocked(profilesApi.me).mockResolvedValue(createProfile());
    const setNativeThemeSource = installElectronApi();

    render(<Settings />);
    await screen.findByDisplayValue("Ada Lovelace");

    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: THEME_STORAGE_KEY,
        oldValue: "system",
        newValue: "dark",
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
    });
    expect(document.documentElement).toHaveClass("dark");
    expect(setNativeThemeSource).toHaveBeenCalledWith("dark");
  });
});

function installElectronApi() {
  const setNativeThemeSource = vi.fn().mockResolvedValue(undefined);
  window.electronAPI = {
    getLinkedInSessionStatus: vi.fn(),
    startLinkedInSession: vi.fn(),
    saveLinkedInSession: vi.fn(),
    notifyJobApplicationQueued: vi.fn(),
    setNativeThemeSource,
  };
  return setNativeThemeSource;
}

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
