import type { IpcMainInvokeEvent } from "electron";
import { ipcMain } from "electron";

export class IpcHandlerRegistry {
  register(
    channel: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors Electron's ipcMain.handle signature
    handler: (event: IpcMainInvokeEvent, ...args: any[]) => any,
  ): this {
    ipcMain.handle(channel, handler);
    return this;
  }
}
