export interface ElectronAPI {
  platform: NodeJS.Platform;
  openExternal: (url: string) => Promise<void>;
  getAppPath: (name: string) => Promise<string>;
  getLinkedInSessionStatus: () => Promise<unknown>;
  startLinkedInSession: () => Promise<unknown>;
  saveLinkedInSession: () => Promise<unknown>;
  notifyJobApplicationQueued: () => Promise<void>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
