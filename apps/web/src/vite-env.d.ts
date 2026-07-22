/// <reference types="vite/client" />

interface DesktopNotificationActivation {
  notificationId: string;
  jobApplicationId?: string;
}

interface Window {
  electronAPI?: {
    platform?: string;
    getLinkedInSessionStatus: () => Promise<unknown>;
    startLinkedInSession: () => Promise<unknown>;
    saveLinkedInSession: () => Promise<unknown>;
    notifyJobApplicationQueued: () => Promise<void>;
    minimizeWindow?: () => Promise<void>;
    maximizeWindow?: () => Promise<void>;
    closeWindow?: () => Promise<void>;
    setNativeThemeSource?: (theme: "light" | "system" | "dark") => Promise<void>;
    onNotificationArrived?: (callback: () => void) => () => void;
    onNativeNotificationActivationAvailable?: (callback: () => void) => () => void;
    consumePendingNativeNotificationActivations?: () => Promise<DesktopNotificationActivation[]>;
    requestNativeNotificationPermission?: () => Promise<void>;
  };
}
