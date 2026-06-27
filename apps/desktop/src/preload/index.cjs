const { contextBridge, ipcRenderer } = require("electron");

const electronAPI = {
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  getAppPath: (name) => ipcRenderer.invoke("get-app-path", name),
  getLinkedInSessionStatus: () => ipcRenderer.invoke("linkedin-session-status"),
  startLinkedInSession: () => ipcRenderer.invoke("linkedin-session-start"),
  saveLinkedInSession: () => ipcRenderer.invoke("linkedin-session-save"),
  scrapeLinkedInJob: (sourceUrl) => ipcRenderer.invoke("linkedin-scrape-job", sourceUrl),
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
