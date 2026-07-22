const { contextBridge, ipcRenderer } = require("electron");

const desktopNotificationChannels = {
  activationAvailable: "desktop-notification-activation-available",
  arrived: "desktop-notification-arrived",
  consumeActivations: "desktop-notification-consume-activations",
  requestPermission: "desktop-notification-request-permission",
};

const electronAPI = {
  platform: process.platform,
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  getAppPath: (name) => ipcRenderer.invoke("get-app-path", name),
  getLinkedInSessionStatus: () => ipcRenderer.invoke("linkedin-session-status"),
  startLinkedInSession: () => ipcRenderer.invoke("linkedin-session-start"),
  saveLinkedInSession: () => ipcRenderer.invoke("linkedin-session-save"),
  notifyJobApplicationQueued: () => ipcRenderer.invoke("job-application-queued"),
  setNativeThemeSource: (source) => ipcRenderer.invoke("set-native-theme-source", source),
  minimizeWindow: () => ipcRenderer.invoke("window-control", "minimize"),
  maximizeWindow: () => ipcRenderer.invoke("window-control", "toggle-maximize"),
  closeWindow: () => ipcRenderer.invoke("window-control", "close"),
  onNotificationArrived: (callback) => subscribe(desktopNotificationChannels.arrived, callback),
  onNativeNotificationActivationAvailable: (callback) =>
    subscribe(desktopNotificationChannels.activationAvailable, callback),
  consumePendingNativeNotificationActivations: () =>
    ipcRenderer.invoke(desktopNotificationChannels.consumeActivations),
  requestNativeNotificationPermission: () =>
    ipcRenderer.invoke(desktopNotificationChannels.requestPermission),
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

function subscribe(channel, callback) {
  if (typeof callback !== "function") return () => undefined;

  const listener = () => callback();
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}
