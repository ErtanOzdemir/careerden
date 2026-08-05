import { EmailDeliveryError } from "@careerden/domain";
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
        throw new EmailDeliveryError({
          code: result.error.name,
          message: `Resend email delivery failed: ${result.error.name}`,
          retryable: isRetryableResendError(result.error),
        });
      }
    },
  };
}

function isRetryableResendError(error: { name: string; statusCode: number | null }): boolean {
  return (
    error.statusCode === null ||
    error.statusCode === 408 ||
    error.statusCode === 425 ||
    error.statusCode === 429 ||
    (error.statusCode >= 500 && error.statusCode <= 599) ||
    error.name === "concurrent_idempotent_requests"
  );
}
