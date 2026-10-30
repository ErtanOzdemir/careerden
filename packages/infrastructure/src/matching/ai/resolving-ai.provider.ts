import type { AiGenerateParams, AiProvider } from "@careerden/domain";
import type { AiProviderSelection } from "./ai-provider.factory.js";
import { createAiProvider } from "./ai-provider.factory.js";

export interface AiProviderSelectionSource {
  // Returns null while the user has not configured an AI provider.
  current(): Promise<AiProviderSelection | null>;
}

export class AiProviderNotConfiguredError extends Error {
  constructor() {
    super(
      "No AI provider is configured. Add an API key on the AI provider page to use AI features.",
    );
    this.name = "AiProviderNotConfiguredError";
  }
}

// Reads the selection on every call so key and model changes apply without a restart.
export class ResolvingAiProvider implements AiProvider {
  constructor(
    private readonly source: AiProviderSelectionSource,
    private readonly create: (selection: AiProviderSelection) => AiProvider = createAiProvider,
  ) {}

  async isConfigured(): Promise<boolean> {
    return (await this.source.current()) !== null;
  }

  async generate<T>(params: AiGenerateParams<T>): Promise<T> {
    const selection = await this.source.current();
    if (!selection) throw new AiProviderNotConfiguredError();

    return this.create(selection).generate(params);
  }
}
