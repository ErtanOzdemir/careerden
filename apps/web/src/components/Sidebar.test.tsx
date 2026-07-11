import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Sidebar from "./Sidebar";

vi.mock("../api/profiles.js", () => ({
  profileUpdatedEvent: "link2cv:profile-updated",
  profilesApi: {
    me: vi.fn().mockRejectedValue(new Error("No profile")),
  },
}));

vi.mock("../api/auth.js", () => ({
  authClient: {
    signOut: vi.fn(),
  },
}));

describe("Sidebar", () => {
  it("reserves top-left space for native macOS window controls", () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("sidebar-brand")).toHaveClass("h-24", "items-end", "pb-4");
  });

  it("does not expose LinkedIn session navigation while browser-session scraping is disabled", () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: /linkedin session/i })).not.toBeInTheDocument();
  });
});
