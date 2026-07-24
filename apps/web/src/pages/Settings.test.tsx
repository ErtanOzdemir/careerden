import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Settings from "./Settings";
import { THEME_STORAGE_KEY } from "../theme.js";
import { DesktopUpdateProvider } from "../desktop-updates/DesktopUpdateProvider.js";

const authMocks = vi.hoisted(() => ({
  changePassword: vi.fn(),
}));
const billingMocks = vi.hoisted(() => ({
  createCheckout: vi.fn(),
  createPortal: vi.fn(),
  redirectToBillingUrl: vi.fn(),
  refresh: vi.fn(async () => undefined),
  useCreditBalance: vi.fn(),
}));

vi.mock("../api/auth.js", () => ({
  authClient: authMocks,
}));

vi.mock("../api/billing.js", () => ({
  billingApi: {
    createCheckout: billingMocks.createCheckout,
    createPortal: billingMocks.createPortal,
  },
  redirectToBillingUrl: billingMocks.redirectToBillingUrl,
}));

vi.mock("../billing/CreditBalanceProvider.js", () => ({
  useCreditBalance: billingMocks.useCreditBalance,
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
    billingMocks.useCreditBalance.mockReturnValue({
      balance: { totalCredits: 10, availableCredits: 9, reservedCredits: 1 },
      balanceError: null,
      isLoading: false,
      isLoadingSubscription: false,
      refresh: billingMocks.refresh,
      subscription: null,
      subscriptionError: null,
    });
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
    expect(screen.getByRole("heading", { name: "AI credits" })).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("opens Creem checkout for an account without a subscription", async () => {
    vi.mocked(profilesApi.me).mockResolvedValue(createProfile());
    billingMocks.createCheckout.mockResolvedValue({ url: "https://checkout.creem.io/ch_123" });

    render(<Settings />);
    fireEvent.click(await screen.findByRole("button", { name: "Subscribe with Creem" }));

    await waitFor(() => expect(billingMocks.createCheckout).toHaveBeenCalledOnce());
    expect(billingMocks.redirectToBillingUrl).toHaveBeenCalledWith(
      "https://checkout.creem.io/ch_123",
    );
    expect(billingMocks.refresh).toHaveBeenCalledOnce();
  });

  it("keeps a zero balance visible when a background refresh reports an error", async () => {
    vi.mocked(profilesApi.me).mockResolvedValue(createProfile());
    billingMocks.useCreditBalance.mockReturnValue({
      balance: { totalCredits: 0, availableCredits: 0, reservedCredits: 0 },
      balanceError: "Could not refresh AI credits.",
      isLoading: false,
      isLoadingSubscription: false,
      refresh: billingMocks.refresh,
      subscription: null,
      subscriptionError: null,
    });

    render(<Settings />);

    expect(await screen.findAllByText("0")).toHaveLength(3);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not refresh AI credits.");
    expect(screen.getByRole("button", { name: "Subscribe with Creem" })).toBeEnabled();
  });

  it("shows scheduled cancellation and opens the Creem customer portal", async () => {
    vi.mocked(profilesApi.me).mockResolvedValue(createProfile());
    billingMocks.useCreditBalance.mockReturnValue({
      balance: { totalCredits: 100, availableCredits: 100, reservedCredits: 0 },
      balanceError: null,
      isLoading: false,
      isLoadingSubscription: false,
      refresh: billingMocks.refresh,
      subscription: {
        provider: "creem",
        planKey: "pro",
        status: "active",
        currentPeriodStart: "2026-07-01T00:00:00.000Z",
        currentPeriodEnd: "2026-08-01T00:00:00.000Z",
        cancelAtPeriodEnd: true,
      },
      subscriptionError: null,
    });
    billingMocks.createPortal.mockResolvedValue({ url: "https://creem.io/portal/cust_123" });

    render(<Settings />);

    expect(await screen.findByText(/Cancellation is scheduled/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Manage billing" }));

    await waitFor(() => expect(billingMocks.createPortal).toHaveBeenCalledOnce());
    expect(billingMocks.redirectToBillingUrl).toHaveBeenCalledWith(
      "https://creem.io/portal/cust_123",
    );
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
      getLinkedInSessionStatus: vi.fn(),
      startLinkedInSession: vi.fn(),
      saveLinkedInSession: vi.fn(),
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

function fillPasswordFields(current: string, next: string, confirmation: string) {
  fireEvent.change(screen.getByLabelText("Current password"), { target: { value: current } });
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: next } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), {
    target: { value: confirmation },
  });
}
