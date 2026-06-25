import { contextBridge, ipcRenderer } from "electron";

const electronAPI = {
  openExternal: (url: string) => ipcRenderer.invoke("open-external", url),
  getAppPath: (name: string) => ipcRenderer.invoke("get-app-path", name),
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
