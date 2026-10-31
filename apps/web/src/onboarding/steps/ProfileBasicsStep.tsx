import { useState } from "react";
import type { FormEvent } from "react";
import { Field, TextAreaField } from "../../components/careerden/field.js";
import { Button } from "../../components/ui/button.js";
import { profilesApi } from "../../api/profiles.js";
import type { ApiUpdateProfilePayload } from "../../api/types.js";
import type { OnboardingStepProps } from "../OnboardingWizard.js";
import { BackButton, StepLayout } from "./StepLayout.js";

export function parseSkills(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(/[,\n]/)
    .map((skill) => skill.trim())
    .filter((skill) => {
      const key = skill.toLowerCase();
      if (!skill || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function ProfileBasicsStep({
  profile,
  onProfileChange,
  onBack,
  onNext,
}: OnboardingStepProps) {
  const initial = {
    fullName: profile.fullName,
    headline: profile.headline ?? "",
    location: profile.location ?? "",
    summary: profile.summary ?? "",
    skills: profile.skills.join(", "),
  };
  const [values, setValues] = useState(initial);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof typeof initial) {
    return (event: { target: { value: string } }) => {
      setValues((current) => ({ ...current, [field]: event.target.value }));
      setError(null);
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fullName = values.fullName.trim();
    if (!fullName) {
      setError("Add your name so it can appear on your documents.");
      return;
    }

    // Only send what changed, so a restart never overwrites richer edits made on the profile page.
    const payload: ApiUpdateProfilePayload = {};
    if (fullName !== initial.fullName) payload.fullName = fullName;
    if (values.headline.trim() !== initial.headline) payload.headline = values.headline.trim();
    if (values.location.trim() !== initial.location) payload.location = values.location.trim();
    if (values.summary.trim() !== initial.summary) payload.summary = values.summary.trim();
    if (values.skills !== initial.skills) payload.skills = parseSkills(values.skills);

    if (Object.keys(payload).length === 0) {
      onNext();
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      onProfileChange(await profilesApi.update(profile.id, payload));
      onNext();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save your profile.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="flex flex-1 flex-col" onSubmit={(event) => void handleSubmit(event)}>
      <StepLayout
        title="Tell us about yourself"
        description="These basics shape every tailored document. You can add experience, education, and projects on your career profile later."
        footer={
          <>
            <BackButton onBack={onBack} disabled={isSaving} />
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : "Continue"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Full name"
            value={values.fullName}
            onChange={set("fullName")}
            placeholder="Ada Lovelace"
          />
          <Field
            label="Headline"
            value={values.headline}
            onChange={set("headline")}
            placeholder="Senior backend engineer"
          />
          <Field
            label="Location"
            value={values.location}
            onChange={set("location")}
            placeholder="Berlin, Germany"
            className="sm:col-span-2"
          />
        </div>
        <TextAreaField
          label="Professional summary"
          value={values.summary}
          onChange={set("summary")}
          placeholder="Two or three sentences about what you do and what you're looking for."
          rows={4}
        />
        <Field
          label="Key skills"
          value={values.skills}
          onChange={set("skills")}
          placeholder="TypeScript, PostgreSQL, System design"
        />
        <p className="-mt-3 text-xs text-muted-foreground">Separate skills with commas.</p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </StepLayout>
    </form>
  );
}
