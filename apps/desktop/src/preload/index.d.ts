export type NativeThemeSource = "system" | "light" | "dark";

export interface DesktopNotificationActivation {
  notificationId: string;
  jobApplicationId?: string;
}

export interface ElectronAPI {
  platform: NodeJS.Platform;
  openExternal: (url: string) => Promise<void>;
  getAppPath: (name: string) => Promise<string>;
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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
