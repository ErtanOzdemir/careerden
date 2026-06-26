import { contextBridge, ipcRenderer } from "electron";

const electronAPI = {
  openExternal: (url: string) => ipcRenderer.invoke("open-external", url),
  getAppPath: (name: string) => ipcRenderer.invoke("get-app-path", name),
  getLinkedInSessionStatus: () => ipcRenderer.invoke("linkedin-session-status"),
  startLinkedInSession: () => ipcRenderer.invoke("linkedin-session-start"),
  saveLinkedInSession: () => ipcRenderer.invoke("linkedin-session-save"),
  scrapeLinkedInJob: (sourceUrl: string) => ipcRenderer.invoke("linkedin-scrape-job", sourceUrl),
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
