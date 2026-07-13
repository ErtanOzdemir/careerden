import { describe, expect, it, vi } from "vitest";
import { createPasswordResetHandler, createRegistrationOtpHandler } from "./auth.js";
import type { AuthEmailSender } from "./auth-email-sender.js";

describe("createRegistrationOtpHandler", () => {
  it("sends email verification OTPs", async () => {
    const authEmailSender = createAuthEmailSender();
    const sendVerificationOTP = createRegistrationOtpHandler(authEmailSender);

    await sendVerificationOTP({
      email: "ada@example.com",
      otp: "123456",
      type: "email-verification",
    });

    expect(authEmailSender.sendRegistrationOtp).toHaveBeenCalledWith({
      email: "ada@example.com",
      otp: "123456",
    });
  });

  it("does not send OTP emails for non-registration flows", async () => {
    const authEmailSender = createAuthEmailSender();
    const sendVerificationOTP = createRegistrationOtpHandler(authEmailSender);

    await sendVerificationOTP({ email: "ada@example.com", otp: "123456", type: "sign-in" });
    await sendVerificationOTP({
      email: "ada@example.com",
      otp: "123456",
      type: "forget-password",
    });
    await sendVerificationOTP({
      email: "ada@example.com",
      otp: "123456",
      type: "change-email",
    });

    expect(authEmailSender.sendRegistrationOtp).not.toHaveBeenCalled();
  });
});

describe("createPasswordResetHandler", () => {
  it("dispatches the Better Auth reset URL without awaiting email delivery", () => {
    const authEmailSender = createAuthEmailSender();
    const sendResetPassword = createPasswordResetHandler(authEmailSender);

    void sendResetPassword({
      user: { email: "ada@example.com" },
      url: "http://localhost:3000/auth/reset-password/token",
    });

    expect(authEmailSender.sendPasswordResetLink).toHaveBeenCalledWith({
      email: "ada@example.com",
      url: "http://localhost:3000/auth/reset-password/token",
    });
  });
});

function createAuthEmailSender(): AuthEmailSender {
  return {
    sendRegistrationOtp: vi.fn(async () => undefined),
    sendPasswordResetLink: vi.fn(async () => undefined),
  };
}
