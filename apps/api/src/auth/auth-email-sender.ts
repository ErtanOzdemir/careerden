import nodemailer from "nodemailer";

export interface AuthEmailSender {
  sendRegistrationOtp(input: { email: string; otp: string }): Promise<void>;
  sendPasswordResetLink(input: { email: string; url: string }): Promise<void>;
}

export interface SmtpAuthEmailSenderConfig {
  from: string;
  host: string;
  port: number;
}

export function createSmtpAuthEmailSender(config: SmtpAuthEmailSenderConfig): AuthEmailSender {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: false,
  });

  return {
    async sendRegistrationOtp({ email, otp }) {
      await transport.sendMail({
        from: config.from,
        to: email,
        subject: "Your Link2CV verification code",
        text: `Your Link2CV verification code is ${otp}. It expires in 5 minutes.`,
        html: `<p>Your Link2CV verification code is <strong>${otp}</strong>.</p><p>It expires in 5 minutes.</p>`,
      });
    },

    async sendPasswordResetLink({ email, url }) {
      await transport.sendMail({
        from: config.from,
        to: email,
        subject: "Reset your Link2CV password",
        text: `Reset your Link2CV password by opening this link: ${url}\n\nThis link expires in 1 hour. If you did not request a password reset, you can ignore this email.`,
        html: `<p>We received a request to reset your Link2CV password.</p><p><a href="${escapeHtml(url)}">Reset your password</a></p><p>This link expires in 1 hour. If you did not request a password reset, you can ignore this email.</p>`,
      });
    },
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
