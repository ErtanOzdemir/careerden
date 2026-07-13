import nodemailer from "nodemailer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSmtpAuthEmailSender } from "./auth-email-sender.js";

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(),
  },
}));

describe("createSmtpAuthEmailSender", () => {
  const sendMail = vi.fn(async () => undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(nodemailer.createTransport).mockReturnValue({ sendMail } as never);
  });

  it("sends registration OTPs through the configured SMTP transport", async () => {
    const sender = createSender();

    await sender.sendRegistrationOtp({ email: "ada@example.com", otp: "123456" });

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: "localhost",
      port: 1025,
      secure: false,
    });
    expect(sendMail).toHaveBeenCalledWith({
      from: "Link2CV <no-reply@link2cv.local>",
      to: "ada@example.com",
      subject: "Your Link2CV verification code",
      text: "Your Link2CV verification code is 123456. It expires in 5 minutes.",
      html: "<p>Your Link2CV verification code is <strong>123456</strong>.</p><p>It expires in 5 minutes.</p>",
    });
  });

  it("sends password-reset links through the configured SMTP transport", async () => {
    const sender = createSender();
    const url =
      "http://localhost:3000/auth/reset-password/token?callbackURL=http%3A%2F%2Flocalhost%3A5173%2Freset-password&source=email";

    await sender.sendPasswordResetLink({ email: "ada@example.com", url });

    expect(sendMail).toHaveBeenCalledWith({
      from: "Link2CV <no-reply@link2cv.local>",
      to: "ada@example.com",
      subject: "Reset your Link2CV password",
      text: `Reset your Link2CV password by opening this link: ${url}\n\nThis link expires in 1 hour. If you did not request a password reset, you can ignore this email.`,
      html: '<p>We received a request to reset your Link2CV password.</p><p><a href="http://localhost:3000/auth/reset-password/token?callbackURL=http%3A%2F%2Flocalhost%3A5173%2Freset-password&amp;source=email">Reset your password</a></p><p>This link expires in 1 hour. If you did not request a password reset, you can ignore this email.</p>',
    });
  });
});

function createSender() {
  return createSmtpAuthEmailSender({
    from: "Link2CV <no-reply@link2cv.local>",
    host: "localhost",
    port: 1025,
  });
}
