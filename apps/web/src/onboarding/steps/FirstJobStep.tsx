import { ClipboardPaste, Link2 } from "lucide-react";
import { Button } from "../../components/ui/button.js";
import type { OnboardingStepProps } from "../OnboardingWizard.js";
import { BackButton, StepLayout } from "./StepLayout.js";

const isDesktop = Boolean(window.electronAPI);

export function FirstJobStep({
  onBack,
  onFinish,
  isFinishing,
}: OnboardingStepProps & { isFinishing: boolean }) {
  const methods = [
    {
      icon: ClipboardPaste,
      title: "Paste a job description",
      text: "Copy the company, role, and description from any job board.",
    },
    ...(isDesktop
      ? [
          {
            icon: Link2,
            title: "Import from LinkedIn",
            text: "Paste a public LinkedIn job link and Careerden fills in the details.",
          },
        ]
      : []),
  ];

  return (
    <StepLayout
      title="Add your first job"
      description="Careerden compares each role with your profile, then drafts a tailored CV and cover letter for you to review."
      footer={
        <>
          <BackButton onBack={onBack} disabled={isFinishing} />
          <Button
            variant="outline"
            disabled={isFinishing}
            onClick={() => onFinish({ openAddJob: false })}
          >
            Go to dashboard
          </Button>
          <Button disabled={isFinishing} onClick={() => onFinish({ openAddJob: true })}>
            Add my first job
          </Button>
        </>
      }
    >
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {methods.map((method) => (
          <li key={method.title} className="rounded-xl border border-border bg-card p-4">
            <method.icon className="size-4 text-muted-foreground" />
            <p className="mt-2 text-sm font-semibold text-foreground">{method.title}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{method.text}</p>
          </li>
        ))}
      </ul>
    </StepLayout>
  );
}
