/// <reference types="vite/client" />

interface Window {
  electronAPI?: {
    getLinkedInSessionStatus: () => Promise<unknown>;
    startLinkedInSession: () => Promise<unknown>;
    saveLinkedInSession: () => Promise<unknown>;
    scrapeLinkedInJob: (sourceUrl: string) => Promise<unknown>;
  };
}
