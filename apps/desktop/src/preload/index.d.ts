export interface ElectronAPI {
  openExternal: (url: string) => Promise<void>;
  getAppPath: (name: string) => Promise<string>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
