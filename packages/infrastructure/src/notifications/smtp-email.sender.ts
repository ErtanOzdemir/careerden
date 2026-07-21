import nodemailer from "nodemailer";
import type { EmailSender } from "@careerden/domain";

export interface SmtpEmailSenderConfig {
  from: string;
  host: string;
  port: number;
}

export function createSmtpEmailSender(config: SmtpEmailSenderConfig): EmailSender {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: false,
  });

  return {
    async send(message) {
      await transport.sendMail({
        ...message,
        from: config.from,
      });
    },
  };
}
