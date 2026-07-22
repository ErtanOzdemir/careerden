import { useEffect, useId, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "../components/ui/button.js";
import { Panel, PanelHeader } from "../components/careerden/panel.js";
import { Modal } from "../components/careerden/modal.js";
import { Field } from "../components/careerden/field.js";
import { cn } from "../lib/utils.js";
import { profilesApi } from "../api/profiles.js";
import type { ApiProfile } from "../api/types.js";
import { authClient } from "../api/auth.js";
import {
  getStoredTheme,
  setThemePreference,
  subscribeToThemeChanges,
  type Theme,
} from "../theme.js";
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
  Eye,
  EyeOff,
  LockKeyhole,
} from "lucide-react";

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
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmedPassword, setConfirmedPassword] = useState("");
  const [isCurrentPasswordVisible, setIsCurrentPasswordVisible] = useState(false);
  const [isNewPasswordVisible, setIsNewPasswordVisible] = useState(false);
  const [isConfirmedPasswordVisible, setIsConfirmedPasswordVisible] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

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
    return subscribeToThemeChanges(setTheme);
  }, []);

  function handleThemeChange(next: Theme) {
    setTheme(next);
    setThemePreference(next);
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

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword.length < 8 || newPassword.length > 128) {
      setPasswordError("New password must be between 8 and 128 characters.");
      return;
    }

    if (newPassword !== confirmedPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setIsChangingPassword(true);
    const result = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    setIsChangingPassword(false);

    if (result.error) {
      setPasswordError(result.error.message ?? "Could not update your password.");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmedPassword("");
    setPasswordSuccess("Password updated. Other sessions have been signed out.");
  }

  return (
    <div className="space-y-6">
      <Panel className="flex flex-col gap-4 border-info/20 bg-info-soft/40 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-info-soft text-info">
            <ArrowUpCircle className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Careerden is up to date</p>
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
          <LockKeyhole className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Security</h2>
        </div>
        <form
          className="space-y-4 border-t border-border px-5 py-4"
          onSubmit={(event) => void handlePasswordChange(event)}
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <SettingsPasswordField
              autoComplete="current-password"
              isVisible={isCurrentPasswordVisible}
              label="Current password"
              onChange={setCurrentPassword}
              onToggleVisibility={() => setIsCurrentPasswordVisible((value) => !value)}
              value={currentPassword}
            />
            <SettingsPasswordField
              autoComplete="new-password"
              isVisible={isNewPasswordVisible}
              label="New password"
              onChange={setNewPassword}
              onToggleVisibility={() => setIsNewPasswordVisible((value) => !value)}
              value={newPassword}
            />
            <SettingsPasswordField
              autoComplete="new-password"
              isVisible={isConfirmedPasswordVisible}
              label="Confirm new password"
              onChange={setConfirmedPassword}
              onToggleVisibility={() => setIsConfirmedPasswordVisible((value) => !value)}
              value={confirmedPassword}
            />
          </div>
          {passwordError && (
            <p role="alert" className="text-sm text-destructive">
              {passwordError}
            </p>
          )}
          {passwordSuccess && (
            <p role="status" className="text-sm text-success">
              {passwordSuccess}
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Use between 8 and 128 characters. Updating your password signs out other sessions.
            </p>
            <Button type="submit" disabled={isChangingPassword}>
              {isChangingPassword ? "Updating..." : "Update password"}
            </Button>
          </div>
        </form>
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
                aria-pressed={theme === t.id}
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

      <p className="text-center text-xs text-muted-foreground">Careerden · Version 0.1.3</p>

      <Modal open={updateOpen} onClose={() => setUpdateOpen(false)}>
        <div className="flex size-11 items-center justify-center rounded-lg bg-info-soft text-info">
          <ArrowUpCircle className="size-6" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-foreground">Check for updates</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You are running the latest version of Careerden.
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

function SettingsPasswordField({
  autoComplete,
  isVisible,
  label,
  onChange,
  onToggleVisibility,
  value,
}: {
  autoComplete: string;
  isVisible: boolean;
  label: string;
  onChange: (value: string) => void;
  onToggleVisibility: () => void;
  value: string;
}) {
  const id = useId();

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          autoComplete={autoComplete}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 pr-12 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20"
          maxLength={128}
          minLength={8}
          onChange={(event) => onChange(event.target.value)}
          required
          type={isVisible ? "text" : "password"}
          value={value}
        />
        <Button
          aria-label={`${isVisible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          className="absolute inset-y-0 right-2 my-auto size-8 rounded-full"
          size="icon"
          type="button"
          variant="ghost"
          onClick={onToggleVisibility}
        >
          {isVisible ? (
            <EyeOff className="size-4 text-muted-foreground" aria-hidden="true" />
          ) : (
            <Eye className="size-4 text-muted-foreground" aria-hidden="true" />
          )}
        </Button>
      </div>
    </div>
  );
}
