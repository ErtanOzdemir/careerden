import { useMemo, useState } from "react";
import { listHtmlTemplates, renderHtmlTemplate } from "@careerden/contracts";
import { Panel } from "../../components/careerden/panel.js";
import { Toggle } from "../../components/careerden/toggle.js";
import { TemplateThumbnail } from "../../components/TemplateThumbnail.js";
import { Button } from "../../components/ui/button.js";
import { profilesApi } from "../../api/profiles.js";
import type { ApiUpdateProfilePayload } from "../../api/types.js";
import { baseContentFor, hasResumeContent } from "../../lib/base-resume.js";
import { buildPreviewTemplateData } from "../../lib/document-preview.js";
import { sampleResumeProfile } from "../../lib/sample-resume-profile.js";
import { cn } from "../../lib/utils.js";
import type { OnboardingStepProps } from "../OnboardingWizard.js";
import { BackButton, StepLayout } from "./StepLayout.js";

const cvTemplates = listHtmlTemplates("cv");

export function PreferencesStep({ profile, onProfileChange, onBack, onNext }: OnboardingStepProps) {
  const [templateId, setTemplateId] = useState(
    cvTemplates.find((template) => template.id === profile.defaultCvTemplateId)?.id ??
      cvTemplates[0]?.id,
  );
  const [autoRunMatchAnalysis, setAutoRunMatchAnalysis] = useState(profile.autoRunMatchAnalysis);
  const [followUpRemindersEnabled, setFollowUpRemindersEnabled] = useState(
    profile.followUpRemindersEnabled,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const htmlById = useMemo(() => {
    const source = hasResumeContent(profile) ? profile : sampleResumeProfile;
    const data = buildPreviewTemplateData(source, baseContentFor(source));
    return Object.fromEntries(
      cvTemplates.map((template) => [template.id, renderHtmlTemplate(template.id, data)]),
    );
  }, [profile]);

  async function handleContinue() {
    setIsSaving(true);
    setError(null);
    try {
      const payload: ApiUpdateProfilePayload = { autoRunMatchAnalysis, followUpRemindersEnabled };
      if (templateId) payload.defaultCvTemplateId = templateId;
      onProfileChange(await profilesApi.update(profile.id, payload));

      if (followUpRemindersEnabled) {
        // Ask for native notifications here, where the user just opted into reminders.
        await window.electronAPI?.requestNativeNotificationPermission?.().catch(() => {
          /* In-app notifications remain available without native permission. */
        });
      }
      onNext();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save your preferences.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <StepLayout
      title="Choose how Careerden works for you"
      description="Pick the CV layout your tailored documents start from. You can change it any time on the Base resume page."
      footer={
        <>
          <BackButton onBack={onBack} disabled={isSaving} />
          <Button disabled={isSaving} onClick={() => void handleContinue()}>
            {isSaving ? "Saving…" : "Continue"}
          </Button>
        </>
      }
    >
      <div
        role="radiogroup"
        aria-label="CV template"
        className="grid grid-cols-2 gap-4 sm:grid-cols-3"
      >
        {cvTemplates.map((template) => {
          const isActive = template.id === templateId;
          return (
            <button
              key={template.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              title={template.description}
              onClick={() => setTemplateId(template.id)}
              className="group text-left"
            >
              <div
                className={cn(
                  "overflow-hidden rounded-lg border shadow-xs transition-all",
                  isActive
                    ? "border-primary ring-2 ring-ring/40"
                    : "border-border group-hover:border-foreground/30",
                )}
              >
                <TemplateThumbnail html={htmlById[template.id] ?? ""} title={template.name} />
              </div>
              <p
                className={cn(
                  "mt-1.5 truncate text-xs",
                  isActive ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {template.name}
              </p>
            </button>
          );
        })}
      </div>

      <Panel>
        <div className="divide-y divide-border">
          <Toggle
            checked={autoRunMatchAnalysis}
            label="Auto-run match analysis"
            desc="Analyze every job posting as soon as it's added."
            onChange={setAutoRunMatchAnalysis}
          />
          <Toggle
            checked={followUpRemindersEnabled}
            label="Follow-up reminders"
            desc="Get notified 10 minutes before each scheduled follow-up."
            onChange={setFollowUpRemindersEnabled}
          />
        </div>
      </Panel>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </StepLayout>
  );
}
