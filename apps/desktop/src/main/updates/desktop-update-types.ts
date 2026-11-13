export const desktopUpdateIpcChannels = {
  check: "desktop-update-check",
  getState: "desktop-update-get-state",
  restartAndInstall: "desktop-update-restart-and-install",
  stateChanged: "desktop-update-state-changed",
} as const;

export type DesktopUpdateStatus =
  "disabled" | "idle" | "checking" | "up-to-date" | "available" | "downloading" | "ready" | "error";

export interface DesktopUpdateState {
  availableVersion?: string;
  currentVersion: string;
  downloadPercent?: number;
  errorMessage?: string;
  minimumSupportedVersion?: string;
  required: boolean;
  status: DesktopUpdateStatus;
}
