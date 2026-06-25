import { app, ipcMain, shell } from "electron";

export function registerIpcHandlers(): void {
  ipcMain.handle("open-external", (_event, url: string) => {
    void shell.openExternal(url);
  });

  ipcMain.handle("get-app-path", (_event, name: Parameters<typeof app.getPath>[0]) => {
    return app.getPath(name);
  });
}
