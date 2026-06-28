/// <reference types="vite/client" />

interface Window {
  electronAPI?: {
    platform?: string;
    getLinkedInSessionStatus: () => Promise<unknown>;
    startLinkedInSession: () => Promise<unknown>;
    saveLinkedInSession: () => Promise<unknown>;
    scrapeLinkedInJob: (sourceUrl: string) => Promise<unknown>;
    minimizeWindow?: () => Promise<void>;
    maximizeWindow?: () => Promise<void>;
    closeWindow?: () => Promise<void>;
  };
}
