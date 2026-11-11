import { AiProviderError } from "@careerden/domain";
import { APICallError } from "ai";

// Wording providers use for a retired or unknown model, for example OpenAI's "model_not_found",
// Anthropic's 404 "model: …", DeepSeek's "The supported API model names are …", and OpenRouter's "is not a valid
// model ID". Matched only together with the word "model" so unrelated 400s are not retried.
const modelUnavailablePattern =
  /not[ _]?found|does not exist|not exist|not a valid model|invalid model|unknown model|supported (?:api )?model names|deprecated|decommissioned|retired|no longer (?:available|supported)|has been (?:removed|shut ?down)/i;

/**
 * Whether a provider rejected the request because the model is unknown, deprecated, or retired,
 * as opposed to a bad key, a rate limit, or invalid output. The provider clients report this as a
 * domain `AiProviderError` with the `model_unavailable` category; raw SDK errors are still
 * recognized, looking through wrapping errors such as the AI SDK's retry error.
 */
export function isModelUnavailableError(error: unknown): boolean {
  return errorChain(error).some((candidate) => {
    if (candidate instanceof AiProviderError) return candidate.category === "model_unavailable";
    if (!APICallError.isInstance(candidate)) return false;

    const text = `${candidate.message} ${candidate.responseBody ?? ""}`;
    if (!/model/i.test(text)) return false;

    return candidate.statusCode === 404 || modelUnavailablePattern.test(text);
  });
}

function errorChain(error: unknown): unknown[] {
  const chain: unknown[] = [];
  const pending: unknown[] = [error];

  while (pending.length > 0 && chain.length < 10) {
    const current = pending.shift();
    if (current === undefined || current === null || chain.includes(current)) continue;
    chain.push(current);

    if (typeof current === "object") {
      const record = current as { cause?: unknown; lastError?: unknown; errors?: unknown };
      pending.push(record.cause, record.lastError);
      if (Array.isArray(record.errors)) pending.push(...record.errors);
    }
  }

  return chain;
}
