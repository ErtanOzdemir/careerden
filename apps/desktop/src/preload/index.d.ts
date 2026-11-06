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

export interface LocalBackupSummary {
  createdAt: string;
  appVersion: string;
  applications: number;
  files: number;
}

export type LocalDataExportResult =
  | { status: "canceled" }
  | { status: "exported"; fileName: string; summary: LocalBackupSummary }
  | { status: "error"; message: string };

export type LocalDataImportResult =
  | { status: "canceled" }
  | { status: "imported"; snapshotFileName: string; summary: LocalBackupSummary }
  | { status: "error"; message: string };

export interface LocalDataAPI {
  exportData: () => Promise<LocalDataExportResult>;
  importData: () => Promise<LocalDataImportResult>;
  openDataFolder: () => Promise<void>;
}

export interface ElectronAPI {
  platform: NodeJS.Platform;
  edition: DesktopEdition;
  // Present only in the local edition.
  aiCredentials?: AiCredentialsAPI;
  // Present only in the local edition.
  localData?: LocalDataAPI;
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
