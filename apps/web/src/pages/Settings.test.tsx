import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Settings from "./Settings";
import { THEME_STORAGE_KEY } from "../theme.js";
import { DesktopUpdateProvider } from "../desktop-updates/DesktopUpdateProvider.js";

const authMocks = vi.hoisted(() => ({
  changePassword: vi.fn(),
  confirmEmailChange: vi.fn(),
  refetchSession: vi.fn(async () => undefined),
  requestEmailChange: vi.fn(),
  useSession: vi.fn(),
}));
vi.mock("../api/auth.js", () => ({
  accountEmailApi: {
    confirmChange: authMocks.confirmEmailChange,
    requestChange: authMocks.requestEmailChange,
  },
  authClient: authMocks,
  useAccountSession: authMocks.useSession,
}));

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
    authMocks.useSession.mockReturnValue({
      data: {
        user: {
          id: "user-1",
          email: "registered@example.com",
          name: "Ada Account",
        },
      },
      isPending: false,
      refetch: authMocks.refetchSession,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows the registered account email instead of the CV profile email", async () => {
    vi.mocked(profilesApi.me).mockResolvedValue(createProfile({ email: "cv@example.com" }));

    render(<Settings />);

    expect(await screen.findByDisplayValue("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByDisplayValue("registered@example.com")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("cv@example.com")).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Auto-run match analysis" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.queryByText("Auto-generate documents")).not.toBeInTheDocument();
    expect(screen.queryByText("Save drafts before applying")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "AI credits" })).not.toBeInTheDocument();
  });

  it("changes the account email after password and new-address OTP verification", async () => {
    vi.mocked(profilesApi.me).mockResolvedValue(createProfile({ email: "cv@example.com" }));
    authMocks.requestEmailChange.mockResolvedValue({ data: { success: true }, error: null });
    authMocks.confirmEmailChange.mockResolvedValue({
      data: { success: true, otherSessionsRevoked: true },
      error: null,
    });

    render(<Settings />);
    fireEvent.click(await screen.findByRole("button", { name: "Change email" }));

    let dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("New email address"), {
      target: { value: " New.Account@Example.com " },
    });
    fireEvent.change(within(dialog).getByLabelText("Current password"), {
      target: { value: "current-password" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send verification code" }));

    await waitFor(() => {
      expect(authMocks.requestEmailChange).toHaveBeenCalledWith({
        currentPassword: "current-password",
        newEmail: "new.account@example.com",
      });
    });

    dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Verification code"), {
      target: { value: "123456" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Verify and change email" }));

    await waitFor(() => {
      expect(authMocks.confirmEmailChange).toHaveBeenCalledWith({
        newEmail: "new.account@example.com",
        otp: "123456",
      });
    });
    expect(authMocks.refetchSession).toHaveBeenCalledOnce();
    expect(await screen.findByDisplayValue("new.account@example.com")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Account email updated. Other sessions have been signed out.",
    );
    expect(screen.queryByDisplayValue("cv@example.com")).not.toBeInTheDocument();
    expect(profilesApi.update).not.toHaveBeenCalled();
  });

  it("shows password errors without advancing to the OTP step", async () => {
    vi.mocked(profilesApi.me).mockResolvedValue(createProfile());
    authMocks.requestEmailChange.mockResolvedValue({
      data: null,
      error: { message: "Current password is incorrect" },
    });

    render(<Settings />);
    fireEvent.click(await screen.findByRole("button", { name: "Change email" }));

    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("New email address"), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(within(dialog).getByLabelText("Current password"), {
      target: { value: "wrong-password" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send verification code" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Current password is incorrect",
    );
    expect(within(dialog).getByLabelText("New email address")).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Verification code")).not.toBeInTheDocument();
    expect(authMocks.confirmEmailChange).not.toHaveBeenCalled();
  });

  it("validates a changed email locally and reports partial session cleanup", async () => {
    vi.mocked(profilesApi.me).mockResolvedValue(createProfile());
    authMocks.requestEmailChange.mockResolvedValue({ data: { success: true }, error: null });
    authMocks.confirmEmailChange.mockResolvedValue({
      data: { success: true, otherSessionsRevoked: false },
      error: null,
    });

    render(<Settings />);
    fireEvent.click(await screen.findByRole("button", { name: "Change email" }));
    let dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("New email address"), {
      target: { value: "REGISTERED@example.com" },
    });
    fireEvent.change(within(dialog).getByLabelText("Current password"), {
      target: { value: "current-password" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send verification code" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Enter an email address different from your current one.",
    );
    expect(authMocks.requestEmailChange).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText("New email address"), {
      target: { value: "new@example.com" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send verification code" }));
    dialog = await screen.findByRole("dialog");
    const codeInput = await within(dialog).findByLabelText("Verification code");
    fireEvent.change(codeInput, { target: { value: "456789" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Verify and change email" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Account email updated, but some other sessions could not be signed out.",
    );
  });

  it("resends with the verified password and clears sensitive fields when canceled", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    vi.mocked(profilesApi.me).mockResolvedValue(createProfile());
    authMocks.requestEmailChange.mockResolvedValue({ data: { success: true }, error: null });

    render(<Settings />);
    fireEvent.click(await screen.findByRole("button", { name: "Change email" }));
    let dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("New email address"), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(within(dialog).getByLabelText("Current password"), {
      target: { value: "current-password" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send verification code" }));

    dialog = await screen.findByRole("dialog");
    await within(dialog).findByLabelText("Verification code");
    expect(within(dialog).getByRole("button", { name: "Send new code in 1:30" })).toBeDisabled();
    act(() => {
      vi.advanceTimersByTime(90_000);
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send new code" }));
    await waitFor(() => expect(authMocks.requestEmailChange).toHaveBeenCalledTimes(2));
    expect(authMocks.requestEmailChange).toHaveBeenLastCalledWith({
      currentPassword: "current-password",
      newEmail: "new@example.com",
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "Back" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Change email" }));
    dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("New email address")).toHaveValue("");
    expect(within(dialog).getByLabelText("Current password")).toHaveValue("");
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

  it("updates the password, revokes other sessions, and clears the form", async () => {
    vi.mocked(profilesApi.me).mockResolvedValue(createProfile());
    authMocks.changePassword.mockResolvedValue({ data: { user: {} }, error: null });

    render(<Settings />);
    await screen.findByDisplayValue("Ada Lovelace");
    fillPasswordFields("oldpassword123", "newpassword123", "newpassword123");
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => {
      expect(authMocks.changePassword).toHaveBeenCalledWith({
        currentPassword: "oldpassword123",
        newPassword: "newpassword123",
        revokeOtherSessions: true,
      });
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Password updated. Other sessions have been signed out.",
    );
    expect(screen.getByLabelText("Current password")).toHaveValue("");
    expect(screen.getByLabelText("New password")).toHaveValue("");
    expect(screen.getByLabelText("Confirm new password")).toHaveValue("");
  });

  it("validates password confirmation before calling Better Auth", async () => {
    vi.mocked(profilesApi.me).mockResolvedValue(createProfile());

    render(<Settings />);
    await screen.findByDisplayValue("Ada Lovelace");
    fillPasswordFields("oldpassword123", "newpassword123", "different123");
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(screen.getByRole("alert")).toHaveTextContent("New passwords do not match.");
    expect(authMocks.changePassword).not.toHaveBeenCalled();
  });

  it("shows Better Auth password-change errors and toggles visibility", async () => {
    vi.mocked(profilesApi.me).mockResolvedValue(createProfile());
    authMocks.changePassword.mockResolvedValue({
      data: null,
      error: { message: "Current password is incorrect" },
    });

    render(<Settings />);
    await screen.findByDisplayValue("Ada Lovelace");
    fireEvent.click(screen.getByRole("button", { name: "Show current password" }));
    expect(screen.getByLabelText("Current password")).toHaveAttribute("type", "text");
    fillPasswordFields("wrongpassword", "newpassword123", "newpassword123");
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Current password is incorrect");
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

  it("confirms when a manual desktop update check finds no new version", async () => {
    vi.mocked(profilesApi.me).mockResolvedValue(createProfile());
    const upToDateState: DesktopUpdateState = {
      currentVersion: "0.1.6",
      required: false,
      status: "up-to-date",
    };
    const checkForDesktopUpdates = vi.fn().mockResolvedValue(upToDateState);
    window.electronAPI = {
      notifyJobApplicationQueued: vi.fn(),
      getDesktopUpdateState: vi.fn().mockResolvedValue(upToDateState),
      checkForDesktopUpdates,
      restartAndInstallDesktopUpdate: vi.fn(),
      onDesktopUpdateStateChanged: vi.fn(() => () => undefined),
    };

    render(
      <DesktopUpdateProvider>
        <Settings />
      </DesktopUpdateProvider>,
    );

    await screen.findByDisplayValue("Ada Lovelace");
    fireEvent.click(screen.getByRole("button", { name: "Check for updates" }));

    expect(await screen.findByRole("dialog")).toHaveTextContent("Careerden is up to date");
    expect(checkForDesktopUpdates).toHaveBeenCalledOnce();
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
    skillGroups: [],
    updatedAt: "2026-07-04T00:00:00.000Z",
    ...overrides,
  };
}

function fillPasswordFields(current: string, next: string, confirmation: string) {
  fireEvent.change(screen.getByLabelText("Current password"), { target: { value: current } });
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: next } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), {
    target: { value: confirmation },
  });
}
