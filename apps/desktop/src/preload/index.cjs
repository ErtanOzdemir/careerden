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

const aiCredentialsChannels = {
  getStatus: "ai-credentials-get-status",
  remove: "ai-credentials-remove",
  save: "ai-credentials-save",
  setActive: "ai-credentials-set-active",
  test: "ai-credentials-test",
};

const logSettingsChannels = {
  getLevel: "desktop-log-get-level",
  setLevel: "desktop-log-set-level",
};

const edition = process.argv.includes("--careerden-edition=local") ? "local" : "cloud";

const electronAPI = {
  platform: process.platform,
  edition,
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

if (edition === "local") {
  // Only the local edition stores AI keys on the device; the cloud edition never exposes this.
  electronAPI.aiCredentials = {
    getStatus: () => ipcRenderer.invoke(aiCredentialsChannels.getStatus),
    save: (input) => ipcRenderer.invoke(aiCredentialsChannels.save, input),
    remove: (provider) => ipcRenderer.invoke(aiCredentialsChannels.remove, provider),
    setActive: (provider) => ipcRenderer.invoke(aiCredentialsChannels.setActive, provider),
    test: (input) => ipcRenderer.invoke(aiCredentialsChannels.test, input),
  };
  // Only the level is exposed; log contents and paths stay in the main process.
  electronAPI.logging = {
    getLevel: () => ipcRenderer.invoke(logSettingsChannels.getLevel),
    setLevel: (level) => ipcRenderer.invoke(logSettingsChannels.setLevel, level),
  };
}

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
