export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  messageId?: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

export class EmailDeliveryError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(input: { code: string; message: string; retryable: boolean; cause?: unknown }) {
    super(input.message, { cause: input.cause });
    this.name = "EmailDeliveryError";
    this.code = input.code;
    this.retryable = input.retryable;
  }
}
