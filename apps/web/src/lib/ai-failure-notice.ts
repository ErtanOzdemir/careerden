import type { AiProviderFailureDto } from "@careerden/contracts";

export interface AiFailureNotice {
  title: string;
  message: string;
  // Whether the fix lives on the AI provider page: a new key, another provider, or another model.
  showSettings: boolean;
}

// Careerden Unplugged runs on the user's own key, so the user can act on every category.
const localNotices: Record<AiProviderFailureDto["category"], AiFailureNotice> = {
  invalid_api_key: {
    title: "Your API key was rejected",
    message: "Your API key is invalid or revoked. Update it in Settings.",
    showSettings: true,
  },
  insufficient_quota: {
    title: "Your provider account is out of credit",
    message:
      "Your provider account has no balance or quota left. Add credit with your provider, then try again.",
    showSettings: true,
  },
  rate_limited: {
    title: "The provider is busy",
    message: "The provider is temporarily limiting requests. Try again in a few minutes.",
    showSettings: false,
  },
  model_unavailable: {
    title: "The model is unavailable",
    message: "The selected model is no longer available. Choose another model in Settings.",
    showSettings: true,
  },
  provider_unavailable: {
    title: "The provider could not be reached",
    message:
      "The AI provider could not be reached. Check your internet connection and try again in a few minutes.",
    showSettings: false,
  },
  invalid_output: {
    title: "The AI response could not be used",
    message:
      "The AI model returned a response Careerden could not use. Try again, or choose a different model in Settings.",
    showSettings: true,
  },
};

// The cloud edition runs on Careerden's own provider account, so key and balance problems are
// ours to fix and are not the user's to act on.
const cloudServiceIssue: AiFailureNotice = {
  title: "AI analysis is temporarily unavailable",
  message: "Something went wrong on our side. Try again in a few minutes.",
  showSettings: false,
};
const cloudNotices: Record<AiProviderFailureDto["category"], AiFailureNotice> = {
  invalid_api_key: cloudServiceIssue,
  insufficient_quota: cloudServiceIssue,
  model_unavailable: cloudServiceIssue,
  rate_limited: { ...localNotices.rate_limited, title: "AI analysis is busy" },
  provider_unavailable: {
    ...cloudServiceIssue,
    message: "The AI service could not be reached. Try again in a few minutes.",
  },
  invalid_output: {
    title: "The AI response could not be used",
    message: "The AI returned a response Careerden could not use. Try again.",
    showSettings: false,
  },
};

export function describeAiFailure(failure: AiProviderFailureDto, local: boolean): AiFailureNotice {
  return (local ? localNotices : cloudNotices)[failure.category];
}
