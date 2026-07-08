import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Signup from "./Signup";

const authMocks = vi.hoisted(() => ({
  sendVerificationOtp: vi.fn(),
  signUpEmail: vi.fn(),
  useSession: vi.fn(),
  verifyEmail: vi.fn(),
}));

vi.mock("../api/auth", () => ({
  authClient: {
    emailOtp: {
      sendVerificationOtp: authMocks.sendVerificationOtp,
      verifyEmail: authMocks.verifyEmail,
    },
    signUp: {
      email: authMocks.signUpEmail,
    },
    useSession: authMocks.useSession,
  },
}));

describe("Signup", () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it("creates an account and advances to the OTP step", async () => {
    authMocks.useSession.mockReturnValue({ data: null, isPending: false });
    authMocks.signUpEmail.mockResolvedValue({ data: { token: null }, error: null });

    renderSignup();

    fillSignupForm();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(authMocks.signUpEmail).toHaveBeenCalledWith({
        email: "ada@example.com",
        password: "password123",
        name: "Ada Lovelace",
      });
    });

    expect(screen.getByRole("heading", { name: "Verify Email" })).toBeInTheDocument();
    expect(screen.getByText("Enter the code sent to ada@example.com.")).toBeInTheDocument();
  });

  it("verifies the OTP and navigates home", async () => {
    authMocks.useSession.mockReturnValue({ data: null, isPending: false });
    authMocks.signUpEmail.mockResolvedValue({ data: { token: null }, error: null });
    authMocks.verifyEmail.mockResolvedValue({ data: { status: true }, error: null });

    renderSignup();

    fillSignupForm();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
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

  it("resends registration verification codes from the OTP step", async () => {
    authMocks.useSession.mockReturnValue({ data: null, isPending: false });
    authMocks.signUpEmail.mockResolvedValue({ data: { token: null }, error: null });
    authMocks.sendVerificationOtp.mockResolvedValue({ data: { success: true }, error: null });

    renderSignup();

    fillSignupForm();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    await screen.findByRole("heading", { name: "Verify Email" });

    fireEvent.click(screen.getByRole("button", { name: /send new code/i }));

    await waitFor(() => {
      expect(authMocks.sendVerificationOtp).toHaveBeenCalledWith({
        email: "ada@example.com",
        type: "email-verification",
      });
    });
  });

  it("returns from the OTP step so the user can correct the email address", async () => {
    authMocks.useSession.mockReturnValue({ data: null, isPending: false });
    authMocks.signUpEmail.mockResolvedValue({ data: { token: null }, error: null });

    renderSignup();

    fillSignupForm();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    await screen.findByRole("heading", { name: "Verify Email" });

    fireEvent.change(screen.getByLabelText("Verification code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /change email/i }));

    expect(screen.getByRole("heading", { name: "Create Account" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toHaveValue("ada@example.com");

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "ada.corrected@example.com" },
    });
    expect(screen.getByLabelText("Email address")).toHaveValue("ada.corrected@example.com");
    expect(screen.queryByLabelText("Verification code")).not.toBeInTheDocument();
  });

  it("shows OTP verification errors inline", async () => {
    authMocks.useSession.mockReturnValue({ data: null, isPending: false });
    authMocks.signUpEmail.mockResolvedValue({ data: { token: null }, error: null });
    authMocks.verifyEmail.mockResolvedValue({
      data: null,
      error: { message: "Invalid verification code." },
    });

    renderSignup();

    fillSignupForm();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    await screen.findByRole("heading", { name: "Verify Email" });

    fireEvent.change(screen.getByLabelText("Verification code"), {
      target: { value: "000000" },
    });
    fireEvent.click(screen.getByRole("button", { name: /verify email/i }));

    expect(await screen.findByText("Invalid verification code.")).toBeInTheDocument();
  });
});

function renderSignup() {
  render(
    <MemoryRouter initialEntries={["/signup"]}>
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="/" element={<p>Home</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function fillSignupForm() {
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Ada Lovelace" },
  });
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "ada@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "password123" },
  });
}
