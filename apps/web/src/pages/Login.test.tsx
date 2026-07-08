import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Login from "./Login";

const authMocks = vi.hoisted(() => ({
  sendVerificationOtp: vi.fn(),
  signInEmail: vi.fn(),
  useSession: vi.fn(),
  verifyEmail: vi.fn(),
}));

vi.mock("../api/auth", () => ({
  authClient: {
    emailOtp: {
      sendVerificationOtp: authMocks.sendVerificationOtp,
      verifyEmail: authMocks.verifyEmail,
    },
    signIn: {
      email: authMocks.signInEmail,
    },
    useSession: authMocks.useSession,
  },
}));

describe("Login", () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it("shows the OTP step when sign-in resends verification for an unverified email", async () => {
    authMocks.useSession.mockReturnValue({ data: null, isPending: false });
    authMocks.signInEmail.mockResolvedValue({
      data: null,
      error: { code: "EMAIL_NOT_VERIFIED", message: "Email not verified" },
    });

    renderLogin();

    fillLoginForm();
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      expect(authMocks.signInEmail).toHaveBeenCalledWith({
        email: "ada@example.com",
        password: "password123",
      });
    });
    expect(screen.getByRole("heading", { name: "Verify Email" })).toBeInTheDocument();
    expect(screen.getByText("Enter the code sent to ada@example.com.")).toBeInTheDocument();
  });

  it("verifies the resent OTP and navigates home", async () => {
    authMocks.useSession.mockReturnValue({ data: null, isPending: false });
    authMocks.signInEmail.mockResolvedValue({
      data: null,
      error: { code: "EMAIL_NOT_VERIFIED", message: "Email not verified" },
    });
    authMocks.verifyEmail.mockResolvedValue({ data: { status: true }, error: null });

    renderLogin();

    fillLoginForm();
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));
    await screen.findByRole("heading", { name: "Verify Email" });

    fireEvent.change(screen.getByLabelText("Verification code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /verify email/i }));

    await waitFor(() => {
      expect(authMocks.verifyEmail).toHaveBeenCalledWith({
        email: "ada@example.com",
        otp: "123456",
      });
    });
    expect(await screen.findByText("Home")).toBeInTheDocument();
  });

  it("can resend another registration verification code from the login OTP step", async () => {
    authMocks.useSession.mockReturnValue({ data: null, isPending: false });
    authMocks.signInEmail.mockResolvedValue({
      data: null,
      error: { code: "EMAIL_NOT_VERIFIED", message: "Email not verified" },
    });
    authMocks.sendVerificationOtp.mockResolvedValue({ data: { success: true }, error: null });

    renderLogin();

    fillLoginForm();
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));
    await screen.findByRole("heading", { name: "Verify Email" });

    fireEvent.click(screen.getByRole("button", { name: /send new code/i }));

    await waitFor(() => {
      expect(authMocks.sendVerificationOtp).toHaveBeenCalledWith({
        email: "ada@example.com",
        type: "email-verification",
      });
    });
  });

  it("toggles the password visibility control", () => {
    authMocks.useSession.mockReturnValue({ data: null, isPending: false });

    renderLogin();

    fillLoginForm();
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: /show password/i }));

    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: /hide password/i })).toBeInTheDocument();
  });

  it("returns from the OTP step so the user can correct the email address", async () => {
    authMocks.useSession.mockReturnValue({ data: null, isPending: false });
    authMocks.signInEmail.mockResolvedValue({
      data: null,
      error: { code: "EMAIL_NOT_VERIFIED", message: "Email not verified" },
    });

    renderLogin();

    fillLoginForm();
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));
    await screen.findByRole("heading", { name: "Verify Email" });

    fireEvent.change(screen.getByLabelText("Verification code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /change email/i }));

    expect(screen.getByRole("heading", { name: "Get Started Now" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toHaveValue("ada@example.com");

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "ada.corrected@example.com" },
    });
    expect(screen.getByLabelText("Email address")).toHaveValue("ada.corrected@example.com");
    expect(screen.queryByLabelText("Verification code")).not.toBeInTheDocument();
  });
});

function renderLogin() {
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<p>Home</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function fillLoginForm() {
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "ada@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "password123" },
  });
}
