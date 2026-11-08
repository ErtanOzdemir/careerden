export type ApplicationErrorCode =
  | "ai_provider_error"
  | "ai_provider_not_configured"
  | "conflict"
  | "forbidden"
  | "not_found"
  | "payment_required"
  | "validation";

export class ApplicationError extends Error {
  constructor(
    public readonly code: ApplicationErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}
