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

export interface ElectronAPI {
  platform: NodeJS.Platform;
  edition: DesktopEdition;
  // Present only in the local edition.
  aiCredentials?: AiCredentialsAPI;
  // Present only in the local edition.
  logging?: DesktopLoggingAPI;
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
