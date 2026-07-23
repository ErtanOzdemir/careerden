import type { BrowserWindow, IpcMainInvokeEvent } from "electron";

export function isTrustedMainWindowIpcSender(
  event: IpcMainInvokeEvent,
  window: BrowserWindow | null,
): boolean {
  return Boolean(
    window &&
    !window.isDestroyed() &&
    event.sender === window.webContents &&
    event.senderFrame === window.webContents.mainFrame,
  );
}
