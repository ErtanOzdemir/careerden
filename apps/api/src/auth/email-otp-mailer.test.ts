import nodemailer from "nodemailer";
import { describe, expect, it, vi } from "vitest";
import { createSmtpOtpEmailSender } from "./email-otp-mailer.js";

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(),
  },
}));

describe("createSmtpOtpEmailSender", () => {
  it("sends registration OTPs through the configured SMTP transport", async () => {
    const sendMail = vi.fn(async () => undefined);
    vi.mocked(nodemailer.createTransport).mockReturnValue({ sendMail } as never);

    const sender = createSmtpOtpEmailSender({
      from: "Link2CV <no-reply@link2cv.local>",
      host: "localhost",
      port: 1025,
    });

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
});
