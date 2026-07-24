import { describe, expect, it, vi } from "vitest";
import type { EmailSender } from "@careerden/domain";
import {
  createMonthlyCreditProvisioningHooks,
  createPasswordResetHandler,
  createRegistrationOtpHandler,
} from "./auth.js";

describe("createMonthlyCreditProvisioningHooks", () => {
  it("provisions credits after user registration and session creation", async () => {
    const creditProvisioner = { execute: vi.fn(async () => undefined) };
    const hooks = createMonthlyCreditProvisioningHooks(creditProvisioner);

    await hooks.user.create.after({ id: "user-1" });
    await hooks.session.create.after({ userId: "user-1" });

    expect(creditProvisioner.execute).toHaveBeenNthCalledWith(1, "user-1");
    expect(creditProvisioner.execute).toHaveBeenNthCalledWith(2, "user-1");
  });

  it("does not fail registration or login when provisioning needs lazy recovery", async () => {
    const creditProvisioner = {
      execute: vi.fn(async () => {
        throw new Error("database unavailable");
      }),
    };
    const logFailure = vi.fn();
    const hooks = createMonthlyCreditProvisioningHooks(creditProvisioner, logFailure);

    await expect(hooks.user.create.after({ id: "user-1" })).resolves.toBeUndefined();
    await expect(hooks.session.create.after({ userId: "user-1" })).resolves.toBeUndefined();
    expect(logFailure).toHaveBeenCalledWith({
      event: "user.created",
      errorName: "Error",
    });
    expect(logFailure).toHaveBeenCalledWith({
      event: "session.created",
      errorName: "Error",
    });
  });
});

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
