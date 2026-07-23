import type { BrowserWindow, IpcMainInvokeEvent, WebContents, WebFrameMain } from "electron";
import { describe, expect, it, vi } from "vitest";
import { isTrustedMainWindowIpcSender } from "./ipc-sender-policy.js";

describe("isTrustedMainWindowIpcSender", () => {
  it("accepts only the active main window's main frame", () => {
    const mainFrame = {} as WebFrameMain;
    const webContents = { mainFrame } as WebContents;
    const window = {
      isDestroyed: vi.fn(() => false),
      webContents,
    } as unknown as BrowserWindow;

    expect(
      isTrustedMainWindowIpcSender(
        { sender: webContents, senderFrame: mainFrame } as IpcMainInvokeEvent,
        window,
      ),
    ).toBe(true);
    expect(
      isTrustedMainWindowIpcSender(
        { sender: webContents, senderFrame: {} as WebFrameMain } as IpcMainInvokeEvent,
        window,
      ),
    ).toBe(false);
    expect(
      isTrustedMainWindowIpcSender(
        { sender: webContents, senderFrame: null } as IpcMainInvokeEvent,
        window,
      ),
    ).toBe(false);
    expect(
      isTrustedMainWindowIpcSender(
        { sender: {} as WebContents, senderFrame: mainFrame } as IpcMainInvokeEvent,
        window,
      ),
    ).toBe(false);
  });

  it("rejects missing and destroyed windows", () => {
    const event = {
      sender: {} as WebContents,
      senderFrame: {} as WebFrameMain,
    } as IpcMainInvokeEvent;
    const destroyedWindow = {
      isDestroyed: vi.fn(() => true),
      webContents: {},
    } as unknown as BrowserWindow;

    expect(isTrustedMainWindowIpcSender(event, null)).toBe(false);
    expect(isTrustedMainWindowIpcSender(event, destroyedWindow)).toBe(false);
  });
});
