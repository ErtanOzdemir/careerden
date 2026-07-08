import { describe, expect, it, vi } from "vitest";
import { createRegistrationOtpHandler } from "./auth.js";
import type { OtpEmailSender } from "./email-otp-mailer.js";

describe("createRegistrationOtpHandler", () => {
  it("sends email verification OTPs", async () => {
    const otpEmailSender = createOtpEmailSender();
    const sendVerificationOTP = createRegistrationOtpHandler(otpEmailSender);

    await sendVerificationOTP({
      email: "ada@example.com",
      otp: "123456",
      type: "email-verification",
    });

    expect(otpEmailSender.sendRegistrationOtp).toHaveBeenCalledWith({
      email: "ada@example.com",
      otp: "123456",
    });
  });

  it("does not send OTP emails for non-registration flows", async () => {
    const otpEmailSender = createOtpEmailSender();
    const sendVerificationOTP = createRegistrationOtpHandler(otpEmailSender);

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

    expect(otpEmailSender.sendRegistrationOtp).not.toHaveBeenCalled();
  });
});

function createOtpEmailSender(): OtpEmailSender {
  return {
    sendRegistrationOtp: vi.fn(async () => undefined),
  };
}
