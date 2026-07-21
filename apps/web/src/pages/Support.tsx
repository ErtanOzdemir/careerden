import { useState, type FormEvent } from "react";
import { CircleCheck, LifeBuoy, Mail, Send } from "lucide-react";
import { supportApi, type SupportRequestReason } from "../api/support.js";
import { Panel, PanelHeader } from "../components/careerden/panel.js";
import { UnifiedSelect, type UnifiedSelectOption } from "../components/careerden/unified-select.js";
import { Button } from "../components/ui/button.js";

const supportReasons: UnifiedSelectOption[] = [
  { label: "Bug report", value: "bug_report" },
  { label: "Feature request", value: "feature_request" },
  { label: "Other", value: "other" },
];

const fieldClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20";

export default function Support() {
  const [reason, setReason] = useState<SupportRequestReason | "">("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitted(false);

    const trimmedDescription = description.trim();
    if (!reason) {
      setError("Select a support reason.");
      return;
    }
    if (trimmedDescription.length < 10) {
      setError("Description must be at least 10 characters.");
      return;
    }
    if (trimmedDescription.length > 5_000) {
      setError("Description must be 5,000 characters or fewer.");
      return;
    }

    setIsSubmitting(true);
    try {
      await supportApi.submit({ reason, description: trimmedDescription });
      setReason("");
      setDescription("");
      setSubmitted(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "We could not submit your request. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
      <Panel>
        <PanelHeader title="Send a support request" />
        <form className="space-y-5 border-t border-border px-5 py-5" onSubmit={handleSubmit}>
          <UnifiedSelect
            label="Support reason"
            options={supportReasons}
            placeholder="Select a reason"
            value={reason}
            onChange={(value) => setReason(value as SupportRequestReason | "")}
            disabled={isSubmitting}
          />

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="support-description" className="text-sm font-medium text-foreground">
                Detailed description
              </label>
              <span className="text-xs text-muted-foreground">{description.length}/5,000</span>
            </div>
            <textarea
              id="support-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={isSubmitting}
              maxLength={5_000}
              rows={8}
              placeholder="Tell us what happened, what you expected, and any steps that might help us reproduce it."
              className={`${fieldClass} resize-y leading-relaxed`}
            />
            <p className="text-xs text-muted-foreground">Include at least 10 characters.</p>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          {submitted && (
            <p
              role="status"
              className="flex items-center gap-2 rounded-lg border border-success/20 bg-success-soft/50 px-3 py-2 text-sm text-success"
            >
              <CircleCheck className="size-4 text-success" />
              Your support request has been received.
            </p>
          )}

          <Button type="submit" size="lg" disabled={isSubmitting}>
            <Send data-icon="inline-start" />
            {isSubmitting ? "Submitting..." : "Submit request"}
          </Button>
        </form>
      </Panel>

      <Panel className="self-start">
        <div className="space-y-4 px-5 py-5">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <LifeBuoy className="size-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Prefer email?</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              You can also contact the Careerden support team directly.
            </p>
          </div>
          <a
            href="mailto:support@careerden.example"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <Mail className="size-4" />
            support@careerden.example
          </a>
        </div>
      </Panel>
    </div>
  );
}
