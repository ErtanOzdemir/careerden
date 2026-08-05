import type { EmailSender } from "@careerden/domain";
import { Resend } from "resend";

export interface ResendEmailSenderConfig {
  apiKey: string;
  from: string;
}

interface ResendEmailClient {
  emails: Pick<Resend["emails"], "send">;
}

export function createResendEmailSender(
  config: ResendEmailSenderConfig,
  client: ResendEmailClient = new Resend(config.apiKey),
): EmailSender {
  return {
    async send(message) {
      const result = await client.emails.send(
        {
          from: config.from,
          to: message.to,
          subject: message.subject,
          text: message.text,
          ...(message.html === undefined ? {} : { html: message.html }),
        },
        message.messageId ? { idempotencyKey: message.messageId } : undefined,
      );

      if (result.error) {
        throw new Error(`Resend email delivery failed: ${result.error.name}`);
      }
    },
  };
}
