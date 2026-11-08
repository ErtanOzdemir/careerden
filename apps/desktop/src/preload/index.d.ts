export type NativeThemeSource = "system" | "light" | "dark";

export interface DesktopNotificationActivation {
  notificationId: string;
  jobApplicationId?: string;
}

export type DesktopUpdateStatus =
  | "disabled"
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "ready"
  | "error";

export interface DesktopUpdateState {
  availableVersion?: string;
  currentVersion: string;
  downloadPercent?: number;
  errorMessage?: string;
  minimumSupportedVersion?: string;
  required: boolean;
  status: DesktopUpdateStatus;
}

export type DesktopEdition = "cloud" | "local";

export type AiProviderName = "openai" | "gemini" | "deepseek" | "anthropic" | "openrouter";

export interface AiCredentialsStatus {
  encryptionAvailable: boolean;
  activeProvider: AiProviderName | null;
  providers: Array<{ provider: AiProviderName; model?: string; keyHint: string }>;
}

export interface AiCredentialsInput {
  provider: AiProviderName;
  // Omit to keep the stored key, for example when only the model changes.
  apiKey?: string;
  model?: string;
}

export type AiCredentialsTestResult = { ok: true } | { ok: false; message: string };

export interface AiCredentialsAPI {
  getStatus: () => Promise<AiCredentialsStatus>;
  save: (input: AiCredentialsInput) => Promise<AiCredentialsStatus>;
  remove: (provider: AiProviderName) => Promise<AiCredentialsStatus>;
  setActive: (provider: AiProviderName) => Promise<AiCredentialsStatus>;
  test: (input: AiCredentialsInput) => Promise<AiCredentialsTestResult>;
}

export type DesktopLogLevel = "info" | "debug";

export interface DesktopLoggingAPI {
  getLevel: () => Promise<DesktopLogLevel>;
  setLevel: (level: DesktopLogLevel) => Promise<DesktopLogLevel>;
}

export type StartupRecoveryReason =
  | "database-open"
  | "migration"
  | "newer-version"
  | "start-failed"
  | "crash-loop";

export interface LocalDataSnapshot {
  id: string;
  kind: string;
  createdAt: string;
}

export interface StartupRecoveryState {
  reason: StartupRecoveryReason;
  message: string;
  appVersion: string;
  snapshots: LocalDataSnapshot[];
}

export type StartupRecoveryRestoreResult =
  | { status: "restored" }
  | { status: "error"; message: string };

export interface StartupRecoveryAPI {
  // Null unless the local data failed to open in this launch.
  getState: () => Promise<StartupRecoveryState | null>;
  // Relaunches the app on success.
  restore: (snapshotId: string) => Promise<StartupRecoveryRestoreResult>;
  openDataFolder: () => Promise<void>;
  // Copies the diagnostics to the clipboard and returns them.
  copyDiagnostics: () => Promise<string>;
  quit: () => Promise<void>;
}

export interface ElectronAPI {
  platform: NodeJS.Platform;
  edition: DesktopEdition;
  // Present only in the local edition.
  aiCredentials?: AiCredentialsAPI;
  // Present only in the local edition.
  logging?: DesktopLoggingAPI;
  // Present only in the local edition.
  startupRecovery?: StartupRecoveryAPI;
  openExternal: (url: string) => Promise<void>;
  notifyJobApplicationQueued: () => Promise<void>;
  setNativeThemeSource: (source: NativeThemeSource) => Promise<void>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  onNotificationArrived: (callback: () => void) => () => void;
  onNativeNotificationActivationAvailable: (callback: () => void) => () => void;
  consumePendingNativeNotificationActivations: () => Promise<DesktopNotificationActivation[]>;
  requestNativeNotificationPermission: () => Promise<void>;
  getDesktopUpdateState: () => Promise<DesktopUpdateState>;
  checkForDesktopUpdates: () => Promise<DesktopUpdateState | undefined>;
  restartAndInstallDesktopUpdate: () => Promise<void>;
  onDesktopUpdateStateChanged: (callback: (state: DesktopUpdateState) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
