const { contextBridge, ipcRenderer } = require("electron");

const electronAPI = {
  platform: process.platform,
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  getAppPath: (name) => ipcRenderer.invoke("get-app-path", name),
  getLinkedInSessionStatus: () => ipcRenderer.invoke("linkedin-session-status"),
  startLinkedInSession: () => ipcRenderer.invoke("linkedin-session-start"),
  saveLinkedInSession: () => ipcRenderer.invoke("linkedin-session-save"),
  notifyJobApplicationQueued: () => ipcRenderer.invoke("job-application-queued"),
  minimizeWindow: () => ipcRenderer.invoke("window-control", "minimize"),
  maximizeWindow: () => ipcRenderer.invoke("window-control", "toggle-maximize"),
  closeWindow: () => ipcRenderer.invoke("window-control", "close"),
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
