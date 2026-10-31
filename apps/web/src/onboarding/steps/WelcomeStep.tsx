import { HardDrive, KeyRound, Sparkles, UserX, WandSparkles, FileText } from "lucide-react";
import { Button } from "../../components/ui/button.js";
import { isLocalEdition } from "../../edition.js";
import type { OnboardingStepProps } from "../OnboardingWizard.js";
import { StepLayout } from "./StepLayout.js";

const localHighlights = [
  {
    icon: HardDrive,
    title: "Your data stays on this device",
    text: "Profiles, job postings, and documents are stored locally. Nothing is sent to a Careerden server.",
  },
  {
    icon: KeyRound,
    title: "Bring your own AI key",
    text: "Analysis runs with your own provider key, encrypted by your system keychain.",
  },
  {
    icon: UserX,
    title: "No account needed",
    text: "There is nothing to sign up for. Open the app and start tracking roles.",
  },
];

const cloudHighlights = [
  {
    icon: Sparkles,
    title: "10 free AI credits every month",
    text: "Use them for match analysis on the roles you care about most.",
  },
  {
    icon: WandSparkles,
    title: "Tailored to your profile",
    text: "Every CV and cover letter starts from the career profile you set up next.",
  },
  {
    icon: FileText,
    title: "Ready to send",
    text: "Review each document, then download a polished PDF.",
  },
];

export function WelcomeStep({ onNext }: OnboardingStepProps) {
  const highlights = isLocalEdition ? localHighlights : cloudHighlights;

  return (
    <StepLayout
      title={isLocalEdition ? "Welcome to Careerden Unplugged" : "Welcome to Careerden"}
      description="Turn job postings into tailored CVs and cover letters. A few quick steps and you're ready."
      footer={<Button onClick={onNext}>Get started</Button>}
    >
      <ul className="space-y-3">
        {highlights.map((item) => (
          <li
            key={item.title}
            className="flex items-start gap-3.5 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <item.icon className="size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{item.title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{item.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </StepLayout>
  );
}
