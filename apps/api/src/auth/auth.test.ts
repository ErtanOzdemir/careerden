import { describe, expect, it, vi } from "vitest";
import type { EmailSender } from "@careerden/domain";
import { createPasswordResetHandler, createRegistrationOtpHandler } from "./auth.js";

describe("createRegistrationOtpHandler", () => {
  it("sends email verification OTPs", async () => {
    const emailSender = createEmailSender();
    const sendVerificationOTP = createRegistrationOtpHandler(emailSender);

    await sendVerificationOTP({
      email: "ada@example.com",
      otp: "123456",
      type: "email-verification",
    });

    expect(emailSender.send).toHaveBeenCalledWith({
      to: "ada@example.com",
      subject: "Your Careerden verification code",
      text: "Your Careerden verification code is 123456. It expires in 5 minutes.",
      html: "<p>Your Careerden verification code is <strong>123456</strong>.</p><p>It expires in 5 minutes.</p>",
    });
  });

  it("does not send OTP emails for non-registration flows", async () => {
    const emailSender = createEmailSender();
    const sendVerificationOTP = createRegistrationOtpHandler(emailSender);

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

    expect(emailSender.send).not.toHaveBeenCalled();
  });
});

describe("createPasswordResetHandler", () => {
  it("dispatches the Better Auth reset URL without awaiting email delivery", () => {
    const emailSender = createEmailSender();
    const sendResetPassword = createPasswordResetHandler(emailSender);

    void sendResetPassword({
      user: { email: "ada@example.com" },
      url: "http://localhost:3000/auth/reset-password/token",
    });

    expect(emailSender.send).toHaveBeenCalledWith({
      to: "ada@example.com",
      subject: "Reset your Careerden password",
      text: "Reset your Careerden password by opening this link: http://localhost:3000/auth/reset-password/token\n\nThis link expires in 1 hour. If you did not request a password reset, you can ignore this email.",
      html: '<p>We received a request to reset your Careerden password.</p><p><a href="http://localhost:3000/auth/reset-password/token">Reset your password</a></p><p>This link expires in 1 hour. If you did not request a password reset, you can ignore this email.</p>',
    });
  });
});

function createEmailSender(): EmailSender {
  return {
    send: vi.fn(async () => undefined),
  };
}
