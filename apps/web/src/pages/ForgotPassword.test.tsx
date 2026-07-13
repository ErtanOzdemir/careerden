import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ForgotPassword from "./ForgotPassword.js";

const authMocks = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("../api/auth.js", () => ({
  authClient: authMocks,
}));

describe("ForgotPassword", () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it("requests a reset link and shows an account-neutral confirmation", async () => {
    authMocks.useSession.mockReturnValue({ data: null, isPending: false });
    authMocks.requestPasswordReset.mockResolvedValue({ data: { status: true }, error: null });

    renderPage();
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(authMocks.requestPasswordReset).toHaveBeenCalledWith({
        email: "ada@example.com",
        redirectTo: `${window.location.origin}/reset-password`,
      });
    });
    expect(screen.getByRole("heading", { name: "Check Your Email" })).toBeInTheDocument();
    expect(
      screen.getByText("If an account exists for that address, a reset link is on its way."),
    ).toBeInTheDocument();
  });

  it("shows request failures without advancing to the confirmation", async () => {
    authMocks.useSession.mockReturnValue({ data: null, isPending: false });
    authMocks.requestPasswordReset.mockResolvedValue({
      data: null,
      error: { message: "Email delivery is unavailable" },
    });

    renderPage();
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email delivery is unavailable");
    expect(screen.getByRole("heading", { name: "Forgot Password" })).toBeInTheDocument();
  });

  it("redirects authenticated users to Settings", () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });

    renderPage();

    expect(screen.getByText("Settings destination")).toBeInTheDocument();
  });
});

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/forgot-password"]}>
      <Routes>
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/settings" element={<p>Settings destination</p>} />
      </Routes>
    </MemoryRouter>,
  );
}
