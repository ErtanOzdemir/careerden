import nodemailer from "nodemailer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSmtpEmailSender } from "./smtp-email.sender.js";

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(),
  },
}));

describe("createSmtpEmailSender", () => {
  const sendMail = vi.fn(async () => undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(nodemailer.createTransport).mockReturnValue({ sendMail } as never);
  });

  it("sends generic email messages through the configured SMTP transport", async () => {
    const sender = createSmtpEmailSender({
      from: "Link2CV <no-reply@link2cv.local>",
      host: "localhost",
      port: 1025,
    });
    const message = {
      to: "ada@example.com",
      subject: "Welcome",
      text: "Welcome to Link2CV.",
      html: "<p>Welcome to Link2CV.</p>",
      messageId: "<welcome-1@link2cv.local>",
    };

    await sender.send(message);

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: "localhost",
      port: 1025,
      secure: false,
    });
    expect(sendMail).toHaveBeenCalledWith({
      ...message,
      from: "Link2CV <no-reply@link2cv.local>",
    });
  });
});
