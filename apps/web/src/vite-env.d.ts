/// <reference types="vite/client" />

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
  };
}
