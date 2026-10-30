import type { BrowserWindow, BrowserWindowConstructorOptions, Session } from "electron";

export const pdfRendererPartition = "careerden-pdf-renderer";

export interface ElectronPdfRendererDependencies {
  createWindow: (options: BrowserWindowConstructorOptions) => BrowserWindow;
  getSession: (partition: string) => Session;
}

// Prints document HTML with Electron's own Chromium, replacing Playwright in the local edition.
// Templates are self-contained, so the print window runs without JavaScript or network access.
export class ElectronPdfRenderer {
  private queue: Promise<unknown> = Promise.resolve();
  private sessionConfigured = false;

  constructor(private readonly dependencies: ElectronPdfRendererDependencies) {}

  htmlToPdf(html: string): Promise<Buffer> {
    // One print window at a time keeps memory flat when a whole application pack renders.
    const render = this.queue.then(() => this.render(html));
    this.queue = render.catch(() => undefined);
    return render;
  }

  private async render(html: string): Promise<Buffer> {
    this.configureSession();
    const window = this.dependencies.createWindow(getPdfWindowOptions());

    try {
      await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      return await window.webContents.printToPDF({
        pageSize: "A4",
        printBackground: true,
        margins: { marginType: "none" },
      });
    } finally {
      if (!window.isDestroyed()) window.destroy();
    }
  }

  private configureSession(): void {
    if (this.sessionConfigured) return;
    const session = this.dependencies.getSession(pdfRendererPartition);
    session.webRequest.onBeforeRequest((details, callback) => {
      callback({ cancel: !details.url.startsWith("data:") });
    });
    session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    this.sessionConfigured = true;
  }
}

export function getPdfWindowOptions(): BrowserWindowConstructorOptions {
  return {
    show: false,
    width: 794,
    height: 1123,
    webPreferences: {
      contextIsolation: true,
      javascript: false,
      nodeIntegration: false,
      partition: pdfRendererPartition,
      sandbox: true,
      spellcheck: false,
      webSecurity: true,
    },
  };
}
