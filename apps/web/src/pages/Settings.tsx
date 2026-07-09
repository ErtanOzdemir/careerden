import { useEffect, useState } from "react";
import { Button } from "../components/ui/button.js";
import { Panel, PanelHeader } from "../components/link2cv/panel.js";
import { Modal } from "../components/link2cv/modal.js";
import { Field } from "../components/link2cv/field.js";
import { cn } from "../lib/utils.js";
import { profilesApi } from "../api/profiles.js";
import type { ApiProfile } from "../api/types.js";
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
  if (typeof localStorage === "undefined") {
    return "system";
  }

  return (localStorage.getItem("link2cv-theme") as Theme | null) ?? "system";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (theme === "dark") root.classList.add("dark");
  else if (theme === "light") root.classList.add("light");
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("link2cv-theme", theme);
  }
}

function Toggle({
  checked,
  defaultOn = false,
  disabled = false,
  label,
  desc,
  onChange,
}: {
  checked?: boolean;
  defaultOn?: boolean;
  disabled?: boolean;
  label: string;
  desc: string;
  onChange?: (checked: boolean) => void;
}) {
  const [on, setOn] = useState(defaultOn);
  const isOn = checked ?? on;

  function handleClick() {
    const next = !isOn;
    if (checked === undefined) {
      setOn(next);
    }
    onChange?.(next);
  }

  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <button
        role="switch"
        aria-checked={isOn}
        aria-label={label}
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          isOn ? "bg-primary" : "bg-muted",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-4 rounded-full bg-card transition-transform",
            isOn && "translate-x-4",
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
  const [profile, setProfile] = useState<ApiProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingPreference, setIsSavingPreference] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    profilesApi
      .me()
      .then((p) => {
        if (isMounted) {
          setProfile(p);
          setProfileError(null);
        }
      })
      .catch((error) => {
        if (isMounted) {
          setProfileError(error instanceof Error ? error.message : "Failed to load profile.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingProfile(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

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

  async function handleAutoRunMatchAnalysisChange(next: boolean) {
    if (!profile) return;

    const previous = profile;
    setProfile({ ...profile, autoRunMatchAnalysis: next });
    setIsSavingPreference(true);
    setProfileError(null);

    try {
      const updated = await profilesApi.update(profile.id, { autoRunMatchAnalysis: next });
      setProfile(updated);
    } catch (error) {
      setProfile(previous);
      setProfileError(error instanceof Error ? error.message : "Failed to save preference.");
    } finally {
      setIsSavingPreference(false);
    }
  }

  async function handleFollowUpRemindersChange(next: boolean) {
    if (!profile) return;

    const previous = profile;
    setProfile({ ...profile, followUpRemindersEnabled: next });
    setIsSavingPreference(true);
    setProfileError(null);

    try {
      const updated = await profilesApi.update(profile.id, { followUpRemindersEnabled: next });
      setProfile(updated);
    } catch (error) {
      setProfile(previous);
      setProfileError(error instanceof Error ? error.message : "Failed to save preference.");
    } finally {
      setIsSavingPreference(false);
    }
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
            <p className="mt-0.5 text-sm text-muted-foreground">
              You're running the latest version.
            </p>
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
          <Field
            label="Display name"
            value={profile?.fullName ?? (isLoadingProfile ? "Loading..." : "")}
            readOnly
          />
          <Field
            label="Email"
            type="email"
            value={profile?.email ?? (isLoadingProfile ? "Loading..." : "")}
            readOnly
          />
        </div>
        {profileError && (
          <p className="border-t border-border px-5 py-3 text-sm text-destructive">
            {profileError}
          </p>
        )}
      </Panel>

      <Panel>
        <div className="flex items-center gap-2.5 px-5 py-4">
          <Sparkles className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Processing preferences</h2>
        </div>
        <div className="divide-y divide-border border-t border-border">
          <Toggle
            checked={profile?.autoRunMatchAnalysis ?? true}
            disabled={!profile || isSavingPreference}
            label="Auto-run match analysis"
            desc="Analyze every job posting as soon as it's added."
            onChange={(checked) => void handleAutoRunMatchAnalysisChange(checked)}
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
            checked={profile?.followUpRemindersEnabled ?? true}
            disabled={!profile || isSavingPreference}
            label="Follow-up reminders"
            desc="Automatically notify you 10 minutes before each scheduled follow-up."
            onChange={(checked) => void handleFollowUpRemindersChange(checked)}
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
