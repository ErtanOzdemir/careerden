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
