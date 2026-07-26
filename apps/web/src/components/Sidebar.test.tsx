import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import Sidebar from "./Sidebar";

vi.mock("../api/profiles.js", () => ({
  profileUpdatedEvent: "careerden:profile-updated",
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
  afterEach(cleanup);

  it("reserves top-left space for native macOS window controls", () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("sidebar-brand")).toHaveClass("h-24", "items-end", "pb-4");
  });

  it("links to the help and support page", () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /help & support/i })).toHaveAttribute(
      "href",
      "/support",
    );
  });
});
