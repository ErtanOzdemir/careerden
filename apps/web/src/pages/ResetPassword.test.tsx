import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import ResetPassword from "./ResetPassword.js";

const authMocks = vi.hoisted(() => ({
  resetPassword: vi.fn(),
}));

vi.mock("../api/auth.js", () => ({
  authClient: authMocks,
}));

describe("ResetPassword", () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it("resets the password using the token from the URL", async () => {
    authMocks.resetPassword.mockResolvedValue({ data: { status: true }, error: null });

    renderPage("/reset-password?token=valid-token");
    fillPasswordFields("newpassword123", "newpassword123");
    fireEvent.click(screen.getByRole("button", { name: /^reset password$/i }));

    await waitFor(() => {
      expect(authMocks.resetPassword).toHaveBeenCalledWith({
        newPassword: "newpassword123",
        token: "valid-token",
      });
    });
    expect(screen.getByRole("heading", { name: "Password Updated" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /continue to login/i })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("validates password length and confirmation before calling Better Auth", () => {
    renderPage("/reset-password?token=valid-token");
    fillPasswordFields("short", "short");
    fireEvent.submit(screen.getByRole("button", { name: /^reset password$/i }).closest("form")!);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Password must be between 8 and 128 characters.",
    );
    expect(authMocks.resetPassword).not.toHaveBeenCalled();

    fillPasswordFields("newpassword123", "different123");
    fireEvent.submit(screen.getByRole("button", { name: /^reset password$/i }).closest("form")!);

    expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match.");
    expect(authMocks.resetPassword).not.toHaveBeenCalled();
  });

  it.each(["/reset-password", "/reset-password?error=INVALID_TOKEN"])(
    "shows an invalid-link state for %s",
    (entry) => {
      renderPage(entry);

      expect(screen.getByRole("heading", { name: "Reset Link Invalid" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /request a new link/i })).toHaveAttribute(
        "href",
        "/forgot-password",
      );
      expect(authMocks.resetPassword).not.toHaveBeenCalled();
    },
  );

  it("shows errors returned for expired or already-used tokens", async () => {
    authMocks.resetPassword.mockResolvedValue({
      data: null,
      error: { message: "Invalid token" },
    });

    renderPage("/reset-password?token=expired-token");
    fillPasswordFields("newpassword123", "newpassword123");
    fireEvent.click(screen.getByRole("button", { name: /^reset password$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid token");
  });

  it("toggles password visibility controls", () => {
    renderPage("/reset-password?token=valid-token");

    expect(screen.getByLabelText("New password")).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show new password" }));
    expect(screen.getByLabelText("New password")).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide new password" })).toBeInTheDocument();
  });
});

function renderPage(entry: string) {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <ResetPassword />
    </MemoryRouter>,
  );
}

function fillPasswordFields(newPassword: string, confirmedPassword: string) {
  fireEvent.change(screen.getByLabelText("New password"), {
    target: { value: newPassword },
  });
  fireEvent.change(screen.getByLabelText("Confirm new password"), {
    target: { value: confirmedPassword },
  });
}
