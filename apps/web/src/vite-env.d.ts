/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CAREERDEN_EDITION?: "cloud" | "local";
}

interface DesktopNotificationActivation {
  notificationId: string;
  jobApplicationId?: string;
}

type DesktopUpdateStatus =
  | "disabled"
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "ready"
  | "error";

interface DesktopUpdateState {
  availableVersion?: string;
  currentVersion: string;
  downloadPercent?: number;
  errorMessage?: string;
  minimumSupportedVersion?: string;
  required: boolean;
  status: DesktopUpdateStatus;
}

type AiProviderName = "openai" | "gemini" | "deepseek" | "anthropic" | "openrouter";

interface AiCredentialsStatus {
  encryptionAvailable: boolean;
  activeProvider: AiProviderName | null;
  providers: Array<{ provider: AiProviderName; model?: string; keyHint: string }>;
}

interface AiCredentialsInput {
  provider: AiProviderName;
  apiKey?: string;
  model?: string;
}

type AiCredentialsTestResult = { ok: true } | { ok: false; message: string };

type DesktopLogLevel = "info" | "debug";

type StartupRecoveryReason =
  | "database-open"
  | "migration"
  | "newer-version"
  | "start-failed"
  | "crash-loop";

interface StartupRecoveryState {
  reason: StartupRecoveryReason;
  message: string;
  appVersion: string;
  snapshots: Array<{ id: string; kind: string; createdAt: string }>;
}

type StartupRecoveryRestoreResult = { status: "restored" } | { status: "error"; message: string };

interface Window {
  electronAPI?: {
    platform?: string;
    edition?: "cloud" | "local";
    // Present only in the local desktop edition. Never returns a stored key.
    aiCredentials?: {
      getStatus: () => Promise<AiCredentialsStatus>;
      save: (input: AiCredentialsInput) => Promise<AiCredentialsStatus>;
      remove: (provider: AiProviderName) => Promise<AiCredentialsStatus>;
      setActive: (provider: AiProviderName) => Promise<AiCredentialsStatus>;
      test: (input: AiCredentialsInput) => Promise<AiCredentialsTestResult>;
    };
    // Present only in the local desktop edition. Exposes the log level, never log contents.
    logging?: {
      getLevel: () => Promise<DesktopLogLevel>;
      setLevel: (level: DesktopLogLevel) => Promise<DesktopLogLevel>;
    };
    // Present only in the local desktop edition. State is null unless the local data failed to
    // open in this launch.
    startupRecovery?: {
      getState: () => Promise<StartupRecoveryState | null>;
      restore: (snapshotId: string) => Promise<StartupRecoveryRestoreResult>;
      openDataFolder: () => Promise<void>;
      copyDiagnostics: () => Promise<string>;
      quit: () => Promise<void>;
    };
    openExternal?: (url: string) => Promise<void>;
    notifyJobApplicationQueued: () => Promise<void>;
    minimizeWindow?: () => Promise<void>;
    maximizeWindow?: () => Promise<void>;
    closeWindow?: () => Promise<void>;
    setNativeThemeSource?: (theme: "light" | "system" | "dark") => Promise<void>;
    onNotificationArrived?: (callback: () => void) => () => void;
    onNativeNotificationActivationAvailable?: (callback: () => void) => () => void;
    consumePendingNativeNotificationActivations?: () => Promise<DesktopNotificationActivation[]>;
    requestNativeNotificationPermission?: () => Promise<void>;
    getDesktopUpdateState?: () => Promise<DesktopUpdateState>;
    checkForDesktopUpdates?: () => Promise<DesktopUpdateState | undefined>;
    restartAndInstallDesktopUpdate?: () => Promise<void>;
    onDesktopUpdateStateChanged?: (callback: (state: DesktopUpdateState) => void) => () => void;
  };
}
