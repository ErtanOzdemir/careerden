import type { AiGenerateParams } from "@careerden/domain";
import { generateText, Output, type LanguageModel } from "ai";
import { toAiProviderError } from "./to-ai-provider-error.js";

export type AiProviderOptions = Parameters<typeof generateText>[0]["providerOptions"];

/**
 * Shared generation path for every AI provider.
 *
 * `Output.object` validates the model's JSON against `params.outputSchema` inside `generateText`,
 * so callers must pass a lenient schema and tighten afterwards — a strict schema here turns one bad
 * field into a failed job. The low temperature keeps structured output stable across retries.
 *
 * Every provider failure leaves as a domain `AiProviderError`, so callers can tell a bad key from
 * an outage, and SDK errors carrying the request body never reach logs.
 */
export async function generateWithOutputSchema<T>(
  provider: string,
  model: LanguageModel,
  params: AiGenerateParams<T>,
  providerOptions?: AiProviderOptions,
): Promise<T> {
  try {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: params.outputSchema }),
      system: params.system,
      prompt: params.prompt,
      temperature: 0.2,
      maxRetries: 2,
      ...(providerOptions ? { providerOptions } : {}),
    });

    return params.outputSchema.parse(output);
  } catch (error) {
    throw toAiProviderError(error, provider) ?? error;
  }
}
