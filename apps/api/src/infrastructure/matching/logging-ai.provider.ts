import type { AiGenerateParams, AiProvider } from "@careerden/domain";
import type { AiProviderName, StructuredLogger } from "@careerden/infrastructure";
import { describeErrorForLog } from "@careerden/infrastructure";

export type AiErrorCategory =
  | "authentication"
  | "rate_limit"
  | "provider_unavailable"
  | "invalid_request"
  | "invalid_output"
  | "timeout"
  | "network"
  | "unknown";

// Records failed AI calls with their provider, category, and status code. Prompts and model output
// stay out of the log.
export class LoggingAiProvider implements AiProvider {
  constructor(
    private readonly inner: AiProvider,
    private readonly provider: AiProviderName,
    private readonly log: StructuredLogger,
  ) {}

  async generate<T>(params: AiGenerateParams<T>): Promise<T> {
    try {
      return await this.inner.generate(params);
    } catch (error) {
      const fields = describeErrorForLog(error);
      this.log({
        level: "error",
        event: "ai.request_failed",
        fields: {
          provider: this.provider,
          category: categorizeAiError(fields.errorName, fields.statusCode),
          ...fields,
        },
      });
      throw error;
    }
  }
}

export function categorizeAiError(errorName: unknown, statusCode: unknown): AiErrorCategory {
  if (errorName === "AiOutputValidationError") return "invalid_output";
  if (typeof statusCode === "number") {
    if (statusCode === 401 || statusCode === 403) return "authentication";
    if (statusCode === 429) return "rate_limit";
    if (statusCode === 408) return "timeout";
    if (statusCode >= 500) return "provider_unavailable";
    if (statusCode >= 400) return "invalid_request";
  }
  if (errorName === "TimeoutError" || errorName === "AbortError") return "timeout";
  if (errorName === "TypeError" || errorName === "FetchError") return "network";
  return "unknown";
}
