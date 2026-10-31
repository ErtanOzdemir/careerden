import { useState } from "react";
import { BrandLogo } from "../components/BrandLogo.js";
import { UnpluggedBadge } from "../components/UnpluggedBadge.js";
import { profilesApi } from "../api/profiles.js";
import type { ApiProfile } from "../api/types.js";
import { isLocalEdition } from "../edition.js";
import { cn } from "../lib/utils.js";
import { WelcomeStep } from "./steps/WelcomeStep.js";
import { AiProviderStep } from "./steps/AiProviderStep.js";
import { ProfileBasicsStep } from "./steps/ProfileBasicsStep.js";
import { PreferencesStep } from "./steps/PreferencesStep.js";
import { FirstJobStep } from "./steps/FirstJobStep.js";

export interface OnboardingFinish {
  openAddJob: boolean;
}

export interface OnboardingStepProps {
  profile: ApiProfile;
  onProfileChange: (profile: ApiProfile) => void;
  onBack?: () => void;
  onNext: () => void;
  onFinish: (finish: OnboardingFinish) => void;
}

type StepId = "welcome" | "ai-provider" | "profile" | "preferences" | "first-job";

const stepLabels: Record<StepId, string> = {
  welcome: "Welcome",
  "ai-provider": "AI provider",
  profile: "Profile",
  preferences: "Preferences",
  "first-job": "First job",
};

export function onboardingSteps(options: { local: boolean; hasAiBridge: boolean }): StepId[] {
  return [
    "welcome",
    ...(options.local && options.hasAiBridge ? (["ai-provider"] as const) : []),
    "profile",
    "preferences",
    "first-job",
  ];
}

export function OnboardingWizard({
  profile,
  onProfileChange,
  onFinish,
}: {
  profile: ApiProfile;
  onProfileChange: (profile: ApiProfile) => void;
  onFinish: (finish: OnboardingFinish) => void;
}) {
  const steps = onboardingSteps({
    local: isLocalEdition,
    hasAiBridge: Boolean(window.electronAPI?.aiCredentials),
  });
  const [index, setIndex] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const step = steps[index];

  async function finish(result: OnboardingFinish) {
    setIsFinishing(true);
    setError(null);
    try {
      await profilesApi.updateOnboarding({ completed: true });
      onFinish(result);
    } catch (finishError) {
      setError(finishError instanceof Error ? finishError.message : "Could not finish setup.");
      setIsFinishing(false);
    }
  }

  const stepProps: OnboardingStepProps = {
    profile,
    onProfileChange,
    onBack: index > 0 ? () => setIndex(index - 1) : undefined,
    onNext: () => setIndex(Math.min(index + 1, steps.length - 1)),
    onFinish: (result) => void finish(result),
  };

  return (
    <div className="scrollbar-soft flex h-screen flex-col overflow-y-auto bg-background text-foreground">
      {/* Matches the sidebar brand height so the macOS window controls never overlap the logo. */}
      <header className="flex h-24 shrink-0 items-end justify-between gap-4 px-6 pb-4 [-webkit-app-region:drag]">
        <div className="flex items-center gap-2.5">
          <BrandLogo className="size-8 object-contain" />
          <div className="leading-tight">
            <p className="text-sm font-semibold text-foreground">Careerden</p>
            {isLocalEdition && <UnpluggedBadge />}
          </div>
        </div>
        <button
          type="button"
          disabled={isFinishing}
          onClick={() => void finish({ openAddJob: false })}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60 [-webkit-app-region:no-drag]"
        >
          Skip setup
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 pb-12">
        <nav aria-label="Setup progress" className="mb-8">
          <p className="mb-2 text-xs text-muted-foreground">
            Step {index + 1} of {steps.length} · {stepLabels[step]}
          </p>
          <ol className="flex gap-1.5">
            {steps.map((id, position) => (
              <li
                key={id}
                aria-current={position === index ? "step" : undefined}
                aria-label={stepLabels[id]}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  position <= index ? "bg-primary" : "bg-muted",
                )}
              />
            ))}
          </ol>
        </nav>

        {error && (
          <p
            role="alert"
            className="mb-4 rounded-lg bg-danger-soft px-4 py-2.5 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        {step === "welcome" && <WelcomeStep {...stepProps} />}
        {step === "ai-provider" && <AiProviderStep {...stepProps} />}
        {step === "profile" && <ProfileBasicsStep {...stepProps} />}
        {step === "preferences" && <PreferencesStep {...stepProps} />}
        {step === "first-job" && <FirstJobStep {...stepProps} isFinishing={isFinishing} />}
      </main>
    </div>
  );
}
