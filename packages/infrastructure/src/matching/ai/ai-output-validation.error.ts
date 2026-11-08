import { AiProviderError } from "@careerden/domain";
import { NoObjectGeneratedError } from "ai";

/**
 * Model output that failed the Zod schema. Keeps the raw model text as a property so worker logs
 * show what the model actually returned, but out of the message, which is persisted and shown to
 * the user. The cause is a schema or parse error and holds no request data.
 */
export class AiOutputValidationError extends AiProviderError {
  readonly modelText?: string;

  constructor(
    readonly cause: unknown,
    provider?: string,
  ) {
    super({ category: "invalid_output", ...(provider ? { provider } : {}) });
    this.name = "AiOutputValidationError";
    const modelText = NoObjectGeneratedError.isInstance(cause) ? cause.text : undefined;
    if (modelText) this.modelText = modelText.slice(0, 500);
  }
}
