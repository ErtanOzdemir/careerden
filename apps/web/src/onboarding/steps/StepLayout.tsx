import { Button } from "../../components/ui/button.js";

export function StepLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <section className="flex flex-1 flex-col">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
      {children && <div className="mt-6 space-y-5">{children}</div>}
      <div className="mt-8 flex flex-wrap items-center justify-end gap-2">{footer}</div>
    </section>
  );
}

export function BackButton({ onBack, disabled }: { onBack?: () => void; disabled?: boolean }) {
  if (!onBack) return null;

  return (
    <Button type="button" variant="ghost" className="mr-auto" disabled={disabled} onClick={onBack}>
      Back
    </Button>
  );
}
