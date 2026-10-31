import { useEffect, useId, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "../components/ui/button.js";
import { Panel, PanelHeader } from "../components/careerden/panel.js";
import { Modal } from "../components/careerden/modal.js";
import { Field } from "../components/careerden/field.js";
import { Toggle } from "../components/careerden/toggle.js";
import { cn } from "../lib/utils.js";
import {
  formatOtpCooldown,
  getOtpRetryAfterSeconds,
  useOtpResendCooldown,
} from "../lib/otp-resend-cooldown.js";
import { profilesApi } from "../api/profiles.js";
import type { ApiProfile } from "../api/types.js";
import { accountEmailApi, authClient, useAccountSession } from "../api/auth.js";
import { isLocalEdition } from "../edition.js";
import {
  getStoredTheme,
  setThemePreference,
  subscribeToThemeChanges,
  type Theme,
} from "../theme.js";
import { useDesktopUpdates } from "../desktop-updates/DesktopUpdateProvider.js";
import {
  Download,
  Sparkles,
  Bell,
  Palette,
  Compass,
  CircleUser,
  ArrowUpCircle,
  Monitor,
  Sun,
  Moon,
  Eye,
  EyeOff,
  LockKeyhole,
} from "lucide-react";

const themeOptions: { id: Theme; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "system", label: "System", icon: Monitor },
  { id: "dark", label: "Dark", icon: Moon },
];

export default function Settings() {
  const {
    data: session,
    isPending: isLoadingSession,
    refetch: refetchSession,
  } = useAccountSession();
  const {
    checkForUpdates,
    isSupported: isDesktopUpdaterSupported,
    restartAndInstall,
    state: updateState,
  } = useDesktopUpdates();
  const [theme, setTheme] = useState<Theme>(getStoredTheme);
  const [profile, setProfile] = useState<ApiProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingPreference, setIsSavingPreference] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isRestartingOnboarding, setIsRestartingOnboarding] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmedPassword, setConfirmedPassword] = useState("");
  const [isCurrentPasswordVisible, setIsCurrentPasswordVisible] = useState(false);
  const [isNewPasswordVisible, setIsNewPasswordVisible] = useState(false);
  const [isConfirmedPasswordVisible, setIsConfirmedPasswordVisible] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isEmailChangeModalOpen, setIsEmailChangeModalOpen] = useState(false);
  const [emailChangeStep, setEmailChangeStep] = useState<"credentials" | "otp">("credentials");
  const [newAccountEmail, setNewAccountEmail] = useState("");
  const emailChangeResendCooldown = useOtpResendCooldown("change-email", newAccountEmail);
  const [emailChangePassword, setEmailChangePassword] = useState("");
  const [isEmailChangePasswordVisible, setIsEmailChangePasswordVisible] = useState(false);
  const [emailChangeOtp, setEmailChangeOtp] = useState("");
  const [isRequestingEmailChange, setIsRequestingEmailChange] = useState(false);
  const [isConfirmingEmailChange, setIsConfirmingEmailChange] = useState(false);
  const [emailChangeError, setEmailChangeError] = useState<string | null>(null);
  const [emailChangeNotice, setEmailChangeNotice] = useState<string | null>(null);
  const [accountEmailOverride, setAccountEmailOverride] = useState<string | null>(null);
  const [emailChangeResult, setEmailChangeResult] = useState<{
    kind: "success" | "warning";
    message: string;
  } | null>(null);
  const [isUpToDateModalOpen, setIsUpToDateModalOpen] = useState(false);

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

  async function handleRestartOnboarding() {
    setIsRestartingOnboarding(true);
    setOnboardingError(null);
    try {
      await profilesApi.updateOnboarding({ completed: false, checklistDismissed: false });
    } catch (restartError) {
      setOnboardingError(
        restartError instanceof Error ? restartError.message : "Could not restart the setup guide.",
      );
      setIsRestartingOnboarding(false);
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

  function openEmailChangeModal() {
    resetEmailChangeForm();
    setEmailChangeResult(null);
    setIsEmailChangeModalOpen(true);
  }

  function closeEmailChangeModal() {
    if (isRequestingEmailChange || isConfirmingEmailChange) return;
    setIsEmailChangeModalOpen(false);
    resetEmailChangeForm();
  }

  function resetEmailChangeForm() {
    setEmailChangeStep("credentials");
    setNewAccountEmail("");
    setEmailChangePassword("");
    setIsEmailChangePasswordVisible(false);
    setEmailChangeOtp("");
    setEmailChangeError(null);
    setEmailChangeNotice(null);
  }

  async function requestEmailChange(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setEmailChangeError(null);
    setEmailChangeNotice(null);

    const normalizedEmail = newAccountEmail.trim().toLowerCase();
    const currentEmail = (accountEmailOverride ?? session?.user.email ?? "").toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      setEmailChangeError("Enter a valid new email address.");
      return;
    }
    if (normalizedEmail === currentEmail) {
      setEmailChangeError("Enter an email address different from your current one.");
      return;
    }
    if (!emailChangePassword) {
      setEmailChangeError("Enter your current password.");
      return;
    }

    setIsRequestingEmailChange(true);
    const result = await accountEmailApi.requestChange({
      currentPassword: emailChangePassword,
      newEmail: normalizedEmail,
    });
    setIsRequestingEmailChange(false);

    if (result.error) {
      setEmailChangeError(result.error.message ?? "Could not send a verification code.");
      const retryAfterSeconds = getOtpRetryAfterSeconds(result.error);
      if (retryAfterSeconds !== null) {
        emailChangeResendCooldown.start(retryAfterSeconds);
      }
      return;
    }

    emailChangeResendCooldown.start();
    setNewAccountEmail(normalizedEmail);
    setEmailChangeOtp("");
    setEmailChangeStep("otp");
    setEmailChangeNotice(`A verification code was sent to ${normalizedEmail}.`);
  }

  async function confirmEmailChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailChangeError(null);
    setEmailChangeNotice(null);

    const normalizedOtp = emailChangeOtp.trim();
    if (!/^\d{6}$/.test(normalizedOtp)) {
      setEmailChangeError("Enter the 6-digit verification code.");
      return;
    }

    setIsConfirmingEmailChange(true);
    const result = await accountEmailApi.confirmChange({
      newEmail: newAccountEmail,
      otp: normalizedOtp,
    });

    if (result.error) {
      setIsConfirmingEmailChange(false);
      setEmailChangeError(result.error.message ?? "Could not verify the code.");
      return;
    }

    setAccountEmailOverride(newAccountEmail);
    await refetchSession();
    setIsConfirmingEmailChange(false);
    setIsEmailChangeModalOpen(false);
    resetEmailChangeForm();
    setEmailChangeResult(
      result.data.otherSessionsRevoked
        ? {
            kind: "success",
            message: "Account email updated. Other sessions have been signed out.",
          }
        : {
            kind: "warning",
            message:
              "Account email updated, but some other sessions could not be signed out. Sign out those devices manually if needed.",
          },
    );
  }

  async function handleManualUpdateCheck() {
    const result = await checkForUpdates();
    if (result?.status === "up-to-date") {
      setIsUpToDateModalOpen(true);
    }
  }

  return (
    <div className="space-y-6">
      {isDesktopUpdaterSupported && updateState && (
        <Panel className="flex flex-col gap-4 border-info/20 bg-info-soft/40 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-info-soft text-info">
              <ArrowUpCircle className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {getDesktopUpdateTitle(updateState)}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {getDesktopUpdateDescription(updateState)}
              </p>
            </div>
          </div>
          {updateState.status === "ready" ? (
            <Button size="sm" onClick={() => void restartAndInstall()}>
              <Download className="size-3.5" /> Restart and update
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled={
                updateState.status === "checking" ||
                updateState.status === "available" ||
                updateState.status === "downloading"
              }
              onClick={() => void handleManualUpdateCheck()}
            >
              <Download className="size-3.5" />{" "}
              {updateState.status === "checking" ? "Checking…" : "Check for updates"}
            </Button>
          )}
        </Panel>
      )}

      {!isLocalEdition && (
        <>
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
              <div className="space-y-2">
                <Field
                  label="Account email"
                  type="email"
                  value={
                    accountEmailOverride ??
                    session?.user.email ??
                    (isLoadingSession ? "Loading..." : "")
                  }
                  readOnly
                />
                <div className="flex justify-end">
                  <Button
                    className="shrink-0"
                    disabled={!session || isLoadingSession}
                    onClick={openEmailChangeModal}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Change email
                  </Button>
                </div>
              </div>
            </div>
            {profileError && (
              <p className="border-t border-border px-5 py-3 text-sm text-destructive">
                {profileError}
              </p>
            )}
            {emailChangeResult && (
              <p
                className={cn(
                  "border-t border-border px-5 py-3 text-sm",
                  emailChangeResult.kind === "success" ? "text-success" : "text-warning",
                )}
                role={emailChangeResult.kind === "success" ? "status" : "alert"}
              >
                {emailChangeResult.message}
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
        </>
      )}

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

      <Panel>
        <div className="flex items-center gap-2.5 px-5 py-4">
          <Compass className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Setup guide</h2>
        </div>
        <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Walk through the first-run setup again to review your essentials.
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={isRestartingOnboarding}
            onClick={() => void handleRestartOnboarding()}
          >
            {isRestartingOnboarding ? "Opening…" : "Restart setup guide"}
          </Button>
        </div>
        {onboardingError && (
          <p role="alert" className="border-t border-border px-5 py-3 text-sm text-destructive">
            {onboardingError}
          </p>
        )}
      </Panel>

      {updateState && (
        <p className="text-center text-xs text-muted-foreground">
          Careerden · Version {updateState.currentVersion}
        </p>
      )}

      <Modal open={isEmailChangeModalOpen} onClose={closeEmailChangeModal}>
        <h2 className="text-lg font-semibold text-foreground">Change account email</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {emailChangeStep === "credentials"
            ? "Confirm your password, then verify the new email address."
            : `Enter the code sent to ${newAccountEmail}.`}
        </p>

        {emailChangeStep === "credentials" ? (
          <form className="mt-5 space-y-4" onSubmit={(event) => void requestEmailChange(event)}>
            <SettingsTextField
              autoComplete="email"
              label="New email address"
              onChange={setNewAccountEmail}
              required
              type="email"
              value={newAccountEmail}
            />
            <SettingsPasswordField
              autoComplete="current-password"
              isVisible={isEmailChangePasswordVisible}
              label="Current password"
              onChange={setEmailChangePassword}
              onToggleVisibility={() => setIsEmailChangePasswordVisible((isVisible) => !isVisible)}
              value={emailChangePassword}
            />
            {emailChangeError && (
              <p role="alert" className="text-sm text-destructive">
                {emailChangeError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button onClick={closeEmailChangeModal} type="button" variant="outline">
                Cancel
              </Button>
              <Button
                disabled={isRequestingEmailChange || emailChangeResendCooldown.isCoolingDown}
                type="submit"
              >
                {isRequestingEmailChange
                  ? "Sending..."
                  : emailChangeResendCooldown.isCoolingDown
                    ? `Send code in ${formatOtpCooldown(emailChangeResendCooldown.secondsRemaining)}`
                    : "Send verification code"}
              </Button>
            </div>
          </form>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={(event) => void confirmEmailChange(event)}>
            <SettingsTextField
              autoComplete="one-time-code"
              inputMode="numeric"
              label="Verification code"
              maxLength={6}
              onChange={(value) => setEmailChangeOtp(value.replace(/\D/g, "").slice(0, 6))}
              required
              value={emailChangeOtp}
            />
            {emailChangeNotice && (
              <p role="status" className="text-sm text-muted-foreground">
                {emailChangeNotice}
              </p>
            )}
            {emailChangeError && (
              <p role="alert" className="text-sm text-destructive">
                {emailChangeError}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                disabled={isRequestingEmailChange || isConfirmingEmailChange}
                onClick={() => {
                  setEmailChangeStep("credentials");
                  setEmailChangeOtp("");
                  setEmailChangeError(null);
                  setEmailChangeNotice(null);
                }}
                type="button"
                variant="ghost"
              >
                Back
              </Button>
              <Button
                disabled={
                  isRequestingEmailChange ||
                  isConfirmingEmailChange ||
                  emailChangeResendCooldown.isCoolingDown
                }
                onClick={() => void requestEmailChange()}
                type="button"
                variant="outline"
              >
                {isRequestingEmailChange
                  ? "Sending..."
                  : emailChangeResendCooldown.isCoolingDown
                    ? `Send new code in ${formatOtpCooldown(emailChangeResendCooldown.secondsRemaining)}`
                    : "Send new code"}
              </Button>
              <Button disabled={isRequestingEmailChange || isConfirmingEmailChange} type="submit">
                {isConfirmingEmailChange ? "Verifying..." : "Verify and change email"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={isUpToDateModalOpen} onClose={() => setIsUpToDateModalOpen(false)}>
        <div className="flex size-11 items-center justify-center rounded-lg bg-info-soft text-info">
          <ArrowUpCircle className="size-6" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-foreground">Careerden is up to date</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You're running the latest available version.
        </p>
        <div className="mt-6 flex justify-end">
          <Button onClick={() => setIsUpToDateModalOpen(false)}>OK</Button>
        </div>
      </Modal>
    </div>
  );
}

function getDesktopUpdateTitle(state: DesktopUpdateState): string {
  switch (state.status) {
    case "checking":
      return "Checking for updates";
    case "available":
    case "downloading":
      return `Downloading Careerden ${state.availableVersion ?? ""}`.trim();
    case "ready":
      return `Careerden ${state.availableVersion ?? ""} is ready`.trim();
    case "error":
      return "Could not check for updates";
    default:
      return "Careerden is up to date";
  }
}

function getDesktopUpdateDescription(state: DesktopUpdateState): string {
  switch (state.status) {
    case "checking":
      return "Looking for the latest published desktop release.";
    case "available":
      return "The update will download automatically.";
    case "downloading":
      return `Download progress: ${state.downloadPercent ?? 0}%`;
    case "ready":
      return "Restart now to install it, or keep working and update when you quit.";
    case "error":
      return "The update service is unavailable. You can try again.";
    default:
      return "You're running the latest version.";
  }
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

function SettingsTextField({
  autoComplete,
  inputMode,
  label,
  maxLength,
  onChange,
  required = false,
  type = "text",
  value,
}: {
  autoComplete?: string;
  inputMode?: "numeric";
  label: string;
  maxLength?: number;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  value: string;
}) {
  const id = useId();

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={id}
        autoComplete={autoComplete}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20"
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
    </div>
  );
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
