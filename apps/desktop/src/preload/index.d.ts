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

export interface ElectronAPI {
  platform: NodeJS.Platform;
  openExternal: (url: string) => Promise<void>;
  getLinkedInSessionStatus: () => Promise<unknown>;
  startLinkedInSession: () => Promise<unknown>;
  saveLinkedInSession: () => Promise<unknown>;
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
