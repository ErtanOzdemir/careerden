import { useEffect, useState } from "react";
import { Button } from "../components/ui/button.js";
import { Panel, PanelHeader } from "../components/link2cv/panel.js";
import { Modal } from "../components/link2cv/modal.js";
import { Field } from "../components/link2cv/field.js";
import { cn } from "../lib/utils.js";
import {
  Download,
  Sparkles,
  Bell,
  Palette,
  CircleUser,
  ArrowUpCircle,
  Monitor,
  Sun,
  Moon,
} from "lucide-react";

type Theme = "light" | "system" | "dark";

function getStoredTheme(): Theme {
  return (localStorage.getItem("link2cv-theme") as Theme | null) ?? "system";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (theme === "dark") root.classList.add("dark");
  else if (theme === "light") root.classList.add("light");
  localStorage.setItem("link2cv-theme", theme);
}

function Toggle({
  defaultOn = false,
  label,
  desc,
}: {
  defaultOn?: boolean;
  label: string;
  desc: string;
}) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <button
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => setOn(!on)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          on ? "bg-primary" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-4 rounded-full bg-card transition-transform",
            on && "translate-x-4",
          )}
        />
      </button>
    </div>
  );
}

const themeOptions: { id: Theme; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "system", label: "System", icon: Monitor },
  { id: "dark", label: "Dark", icon: Moon },
];

export default function Settings() {
  const [updateOpen, setUpdateOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key === "link2cv-theme") {
        setTheme((event.newValue as Theme) ?? "system");
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  function handleThemeChange(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  return (
    <div className="space-y-6">
      <Panel className="flex flex-col gap-4 border-info/20 bg-info-soft/40 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-info-soft text-info">
            <ArrowUpCircle className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Link2CV is up to date</p>
            <p className="mt-0.5 text-sm text-muted-foreground">You're running the latest version.</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setUpdateOpen(true)}>
          <Download className="size-3.5" /> Check for updates
        </Button>
      </Panel>

      <Panel>
        <div className="flex items-center gap-2.5 px-5 py-4">
          <CircleUser className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Account</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 border-t border-border px-5 py-4 sm:grid-cols-2">
          <Field label="Display name" defaultValue="User" />
          <Field label="Email" type="email" defaultValue="user@email.com" />
        </div>
      </Panel>

      <Panel>
        <div className="flex items-center gap-2.5 px-5 py-4">
          <Sparkles className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Processing preferences</h2>
        </div>
        <div className="divide-y divide-border border-t border-border">
          <Toggle
            defaultOn
            label="Auto-run match analysis"
            desc="Analyze every job posting as soon as it's added."
          />
          <Toggle
            defaultOn
            label="Auto-generate documents"
            desc="Draft a CV and cover letter once analysis completes."
          />
          <Toggle
            label="Save drafts before applying"
            desc="Keep an editable copy of every generated document."
          />
        </div>
      </Panel>

      <Panel>
        <div className="flex items-center gap-2.5 px-5 py-4">
          <Bell className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
        </div>
        <div className="divide-y divide-border border-t border-border">
          <Toggle
            defaultOn
            label="Follow-up reminders"
            desc="Gentle nudges before each scheduled follow-up."
          />
          <Toggle label="Weekly summary" desc="A calm recap of your job search every Monday." />
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Appearance" />
        <div className="flex items-center gap-2.5 border-t border-border px-5 py-4">
          <Palette className="size-4 text-muted-foreground" />
          <span className="text-sm text-foreground">Theme</span>
          <div className="ml-auto flex gap-1.5">
            {themeOptions.map((t) => (
              <button
                key={t.id}
                onClick={() => handleThemeChange(t.id)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  theme === t.id
                    ? "border-primary/30 bg-accent text-accent-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <t.icon className="size-3" />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      <p className="text-center text-xs text-muted-foreground">Link2CV · Version 0.1.0</p>

      <Modal open={updateOpen} onClose={() => setUpdateOpen(false)}>
        <div className="flex size-11 items-center justify-center rounded-lg bg-info-soft text-info">
          <ArrowUpCircle className="size-6" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-foreground">Check for updates</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You are running the latest version of Link2CV.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setUpdateOpen(false)}>
            Close
          </Button>
          <Button onClick={() => setUpdateOpen(false)}>OK</Button>
        </div>
      </Modal>
    </div>
  );
}
