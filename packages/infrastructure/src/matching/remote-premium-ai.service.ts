import {
  AiGenerationError,
  InsufficientCreditsError,
  NotAuthenticatedError,
  type PremiumAiInput,
  type PremiumAiResult,
  type PremiumAiService,
} from "@careerden/domain";

export interface RemotePremiumAiServiceOptions {
  apiUrl: string;
  tokenProvider: () => Promise<string | null>;
}

export class RemotePremiumAiService implements PremiumAiService {
  constructor(private readonly options: RemotePremiumAiServiceOptions) {}

  async generate(input: PremiumAiInput): Promise<PremiumAiResult> {
    const token = await this.options.tokenProvider();

    if (!token) {
      throw new NotAuthenticatedError();
    }

    const response = await fetch(`${this.options.apiUrl}/api/v1/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    if (response.status === 401) {
      throw new NotAuthenticatedError();
    }

    if (response.status === 402) {
      const body = (await response.json().catch(() => ({}))) as { checkoutUrl?: string };
      throw new InsufficientCreditsError(body.checkoutUrl ?? "");
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new AiGenerationError(body.error ?? `Generation failed: ${response.statusText}`);
    }

    return (await response.json()) as PremiumAiResult;
  }
}
