import type { AiGenerateParams } from "@careerden/domain";
import { generateText, NoObjectGeneratedError, Output, type LanguageModel } from "ai";

export type AiProviderOptions = Parameters<typeof generateText>[0]["providerOptions"];

/**
 * Shared generation path for every AI provider.
 *
 * `Output.object` validates the model's JSON against `params.outputSchema` inside `generateText`,
 * so callers must pass a lenient schema and tighten afterwards — a strict schema here turns one bad
 * field into a failed job. The low temperature keeps structured output stable across retries.
 */
export async function generateWithOutputSchema<T>(
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
    throw new AiOutputValidationError(error);
  }
}

/**
 * Carries the raw model text alongside the validation failure. Without it, worker logs show only a
 * Zod issue list with no way to tell what the model actually returned.
 */
export class AiOutputValidationError extends Error {
  readonly modelText?: string;

  constructor(readonly cause: unknown) {
    const modelText = NoObjectGeneratedError.isInstance(cause) ? cause.text : undefined;
    super(
      `AI provider returned output that failed schema validation${modelText ? `: ${modelText.slice(0, 500)}` : ""}`,
    );
    this.name = "AiOutputValidationError";
    this.modelText = modelText;
  }
}
