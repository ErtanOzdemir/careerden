const { contextBridge, ipcRenderer } = require("electron");

const desktopNotificationChannels = {
  activationAvailable: "desktop-notification-activation-available",
  arrived: "desktop-notification-arrived",
  consumeActivations: "desktop-notification-consume-activations",
  requestPermission: "desktop-notification-request-permission",
};

const desktopUpdateChannels = {
  check: "desktop-update-check",
  getState: "desktop-update-get-state",
  restartAndInstall: "desktop-update-restart-and-install",
  stateChanged: "desktop-update-state-changed",
};

const electronAPI = {
  platform: process.platform,
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
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
  getDesktopUpdateState: () => ipcRenderer.invoke(desktopUpdateChannels.getState),
  checkForDesktopUpdates: () => ipcRenderer.invoke(desktopUpdateChannels.check),
  restartAndInstallDesktopUpdate: () => ipcRenderer.invoke(desktopUpdateChannels.restartAndInstall),
  onDesktopUpdateStateChanged: (callback) =>
    subscribeWithPayload(desktopUpdateChannels.stateChanged, callback),
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

function subscribe(channel, callback) {
  if (typeof callback !== "function") return () => undefined;

  const listener = () => callback();
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

function subscribeWithPayload(channel, callback) {
  if (typeof callback !== "function") return () => undefined;

  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}
