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

interface Window {
  electronAPI?: {
    platform?: string;
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
