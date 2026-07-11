import nodemailer from "nodemailer";
import type { NotificationEmailSender } from "@link2cv/domain";

export interface SmtpNotificationEmailSenderConfig {
  from: string;
  host: string;
  port: number;
}

export function createSmtpNotificationEmailSender(
  config: SmtpNotificationEmailSenderConfig,
): NotificationEmailSender {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: false,
  });

  return {
    async sendFollowUpReminder({
      messageId,
      email,
      companyName,
      roleTitle,
      followUpAt,
      title,
      description,
    }) {
      const target = [companyName, roleTitle].filter(Boolean).join(" - ") || "your application";
      const formatted = followUpAt.toLocaleString();

      await transport.sendMail({
        messageId,
        from: config.from,
        to: email,
        subject: `Follow-up reminder: ${title}`,
        text: `Reminder: ${title} — follow up on ${target} at ${formatted}.${description ? `\n\n${description}` : ""}`,
        html: `<p>Reminder: <strong>${title}</strong> — follow up on <strong>${target}</strong> at ${formatted}.</p>${description ? `<p>${description}</p>` : ""}`,
      });
    },
  };
}
