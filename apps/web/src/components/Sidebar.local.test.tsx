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

describe("Sidebar in the local edition", () => {
  afterEach(cleanup);

  it("drops billing, support, and sign-out and labels the workspace as on-device", () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.getByText("On this device")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute("href", "/settings");
    expect(screen.queryByRole("link", { name: /credits & billing/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /help & support/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /log out/i })).not.toBeInTheDocument();
  });
});
