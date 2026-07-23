import type { IpcMain, IpcMainInvokeEvent } from "electron";

type IpcMainRegistrar = Pick<IpcMain, "handle">;
type IpcSenderPolicy = (event: IpcMainInvokeEvent) => boolean;

export class IpcHandlerRegistry {
  constructor(
    private readonly ipcMain: IpcMainRegistrar,
    private readonly isTrustedSender: IpcSenderPolicy,
  ) {}

  register(
    channel: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors Electron's ipcMain.handle signature
    handler: (event: IpcMainInvokeEvent, ...args: any[]) => any,
  ): this {
    this.ipcMain.handle(channel, (event, ...args) => {
      if (!this.isTrustedSender(event)) {
        throw new Error("IPC sender is not trusted");
      }

      return handler(event, ...args);
    });
    return this;
  }
}
