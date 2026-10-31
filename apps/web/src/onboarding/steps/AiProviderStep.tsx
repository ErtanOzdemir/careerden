import { useCallback, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "../../components/ui/button.js";
import { AiProviderPanel } from "../../settings/AiProviderSettings.js";
import type { OnboardingStepProps } from "../OnboardingWizard.js";
import { BackButton, StepLayout } from "./StepLayout.js";

export function AiProviderStep({ onBack, onNext }: OnboardingStepProps) {
  const bridge = window.electronAPI?.aiCredentials;
  const [hasActiveProvider, setHasActiveProvider] = useState(false);
  const handleStatusChange = useCallback((status: AiCredentialsStatus) => {
    setHasActiveProvider(status.activeProvider !== null);
  }, []);

  return (
    <StepLayout
      title="Connect your AI provider"
      description="Careerden uses your own key to analyze job postings and tailor your documents. You pay the provider directly for what you use."
      footer={
        <>
          <BackButton onBack={onBack} />
          <Button variant={hasActiveProvider ? "default" : "outline"} onClick={onNext}>
            {hasActiveProvider ? "Continue" : "Skip for now"}
          </Button>
        </>
      }
    >
      {bridge && <AiProviderPanel bridge={bridge} onStatusChange={handleStatusChange} />}
      {!hasActiveProvider && (
        <p className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm text-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          Without a provider, job postings are saved but not analyzed. You can add a key any time
          from AI provider &amp; API Keys.
        </p>
      )}
    </StepLayout>
  );
}
