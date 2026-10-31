import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle, X } from "lucide-react";
import { profilesApi } from "../api/profiles.js";
import type { ApiProfile } from "../api/types.js";
import { Panel } from "../components/careerden/panel.js";
import { isLocalEdition } from "../edition.js";
import { hasResumeContent } from "../lib/base-resume.js";
import { cn } from "../lib/utils.js";
import { aiProviderPath } from "../settings/AiProviderSettings.js";
import { openAddJobEventName } from "./OnboardingGate.js";

interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  to?: string;
  onClick?: () => void;
}

export function buildChecklistItems(options: {
  profile: ApiProfile;
  hasApplications: boolean;
  aiProviderConfigured: boolean | null;
}): ChecklistItem[] {
  return [
    ...(options.aiProviderConfigured !== null
      ? [
          {
            id: "ai-provider",
            label: "Connect your AI provider",
            done: options.aiProviderConfigured,
            to: aiProviderPath,
          },
        ]
      : []),
    {
      id: "profile",
      label: "Add your experience to your career profile",
      done: hasResumeContent(options.profile),
      to: "/profile",
    },
    {
      id: "template",
      label: "Choose your CV template",
      done: Boolean(options.profile.defaultCvTemplateId),
      to: "/base-resume",
    },
    {
      id: "first-job",
      label: "Add your first job application",
      done: options.hasApplications,
      onClick: () => window.dispatchEvent(new CustomEvent(openAddJobEventName)),
    },
  ];
}

/** The setup steps a new user still has open, derived from their data rather than stored. */
export function OnboardingChecklist({
  profile,
  hasApplications,
}: {
  profile: ApiProfile;
  hasApplications: boolean;
}) {
  const [aiProviderConfigured, setAiProviderConfigured] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(Boolean(profile.onboardingChecklistDismissedAt));

  useEffect(() => {
    const bridge = window.electronAPI?.aiCredentials;
    if (!isLocalEdition || !bridge) return;
    let active = true;
    bridge.getStatus().then(
      (status) => active && setAiProviderConfigured(status.activeProvider !== null),
      () => active && setAiProviderConfigured(false),
    );
    return () => {
      active = false;
    };
  }, []);

  const items = buildChecklistItems({ profile, hasApplications, aiProviderConfigured });
  const completed = items.filter((item) => item.done).length;

  if (dismissed || completed === items.length) return null;

  function handleDismiss() {
    setDismissed(true);
    void profilesApi.updateOnboarding({ checklistDismissed: true }).catch(() => {
      /* The card returns on the next visit if the dismissal could not be saved. */
    });
  }

  return (
    <Panel className="px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Finish setting up Careerden</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {completed} of {items.length} done
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss setup checklist"
          onClick={handleDismiss}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${(completed / items.length) * 100}%` }}
        />
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2">
        {items.map((item) => {
          const content = (
            <>
              {item.done ? (
                <CheckCircle2 className="size-4 shrink-0 text-success" />
              ) : (
                <Circle className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className={cn(item.done && "text-muted-foreground line-through")}>
                {item.label}
              </span>
            </>
          );
          const className =
            "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted/50";

          return (
            <li key={item.id}>
              {item.done ? (
                <div className={cn(className, "hover:bg-transparent")}>{content}</div>
              ) : item.to ? (
                <Link to={item.to} className={className}>
                  {content}
                </Link>
              ) : (
                <button type="button" onClick={item.onClick} className={className}>
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
