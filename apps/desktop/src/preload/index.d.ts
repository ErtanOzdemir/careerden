export interface ElectronAPI {
  openExternal: (url: string) => Promise<void>;
  getAppPath: (name: string) => Promise<string>;
  getLinkedInSessionStatus: () => Promise<unknown>;
  startLinkedInSession: () => Promise<unknown>;
  saveLinkedInSession: () => Promise<unknown>;
  scrapeLinkedInJob: (sourceUrl: string) => Promise<unknown>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
