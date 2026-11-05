import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import Sidebar from "./Sidebar";

vi.mock("../edition.js", () => ({ isLocalEdition: true }));
vi.mock("../api/profiles.js", () => ({
  profileUpdatedEvent: "careerden:profile-updated",
  profilesApi: { me: vi.fn().mockRejectedValue(new Error("No profile")) },
}));
vi.mock("../api/auth.js", () => ({ authClient: { signOut: vi.fn() } }));
vi.mock("../desktop-updates/DesktopUpdateProvider.js", () => ({
  useDesktopUpdates: () => ({
    state: { currentVersion: "1.4.2", required: false, status: "up-to-date" },
  }),
}));

describe("Sidebar in the local edition", () => {
  afterEach(cleanup);

  it("drops billing, support, and sign-out and shows the Unplugged wordmark", () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.getByText("Unplugged")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("link", { name: /ai provider/i })).toHaveAttribute(
      "href",
      "/ai-provider",
    );
    expect(screen.queryByRole("link", { name: /credits & billing/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /help & support/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /log out/i })).not.toBeInTheDocument();
  });

  it("shows the app version instead of the profile card", () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.getByText("Version 1.4.2")).toBeInTheDocument();
    expect(screen.queryByText("Profile", { selector: "p" })).not.toBeInTheDocument();
  });
});
