import { app, ipcMain, shell } from "electron";
import { getLinkedInSessionManager, scrapeLinkedInJob } from "./linkedin-scraping.js";

export function registerIpcHandlers(): void {
  ipcMain.handle("open-external", (_event, url: string) => {
    void shell.openExternal(url);
  });

  ipcMain.handle("get-app-path", (_event, name: Parameters<typeof app.getPath>[0]) => {
    return app.getPath(name);
  });

  ipcMain.handle("linkedin-session-status", async () => {
    return getLinkedInSessionManager().getStatus();
  });

  ipcMain.handle("linkedin-session-start", async () => {
    return getLinkedInSessionManager().startLogin();
  });

  ipcMain.handle("linkedin-session-save", async () => {
    return getLinkedInSessionManager().saveLogin();
  });

  ipcMain.handle("linkedin-scrape-job", async (_event, sourceUrl: string) => {
    return scrapeLinkedInJob(sourceUrl);
  });
}
