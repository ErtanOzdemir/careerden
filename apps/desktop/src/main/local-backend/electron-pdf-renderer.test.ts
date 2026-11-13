import { describe, expect, it, vi } from "vitest";
import {
  ElectronPdfRenderer,
  getPdfWindowOptions,
  pdfRendererPartition,
} from "./electron-pdf-renderer.js";

function createDependencies() {
  const blockers: Array<
    (details: { url: string }, callback: (response: { cancel: boolean }) => void) => void
  > = [];
  const windows: Array<{
    loadURL: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    printToPDF: ReturnType<typeof vi.fn>;
  }> = [];
  const session = {
    webRequest: { onBeforeRequest: vi.fn((listener) => blockers.push(listener)) },
    setPermissionRequestHandler: vi.fn(),
  };

  return {
    blockers,
    windows,
    session,
    dependencies: {
      getSession: vi.fn(() => session as never),
      createWindow: vi.fn(() => {
        const window = {
          loadURL: vi.fn(async () => undefined),
          destroy: vi.fn(),
          isDestroyed: () => false,
          printToPDF: vi.fn(async () => Buffer.from("%PDF")),
        };
        windows.push(window);
        return { ...window, webContents: { printToPDF: window.printToPDF } } as never;
      }),
    },
  };
}

describe("ElectronPdfRenderer", () => {
  it("prints the HTML to an A4 PDF in a hidden window and destroys it", async () => {
    const { dependencies, windows } = createDependencies();

    await expect(new ElectronPdfRenderer(dependencies).htmlToPdf("<p>Ada</p>")).resolves.toEqual(
      Buffer.from("%PDF"),
    );

    expect(dependencies.createWindow).toHaveBeenCalledWith(getPdfWindowOptions());
    expect(windows[0]?.loadURL).toHaveBeenCalledWith(
      `data:text/html;charset=utf-8,${encodeURIComponent("<p>Ada</p>")}`,
    );
    expect(windows[0]?.printToPDF).toHaveBeenCalledWith({
      pageSize: "A4",
      printBackground: true,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    expect(windows[0]?.destroy).toHaveBeenCalled();
  });

  it("runs the print window without JavaScript in an isolated sandbox", () => {
    expect(getPdfWindowOptions()).toMatchObject({
      show: false,
      webPreferences: {
        javascript: false,
        nodeIntegration: false,
        sandbox: true,
        partition: pdfRendererPartition,
      },
    });
  });

  it("blocks every request except the inline document and denies permissions", async () => {
    const { dependencies, blockers, session } = createDependencies();
    const renderer = new ElectronPdfRenderer(dependencies);

    await renderer.htmlToPdf("<p>Ada</p>");
    await renderer.htmlToPdf("<p>Grace</p>");
    const decisions = ["data:text/html,<p>Ada</p>", "https://fonts.example.com/a.woff2"].map(
      (url) => {
        let cancel: boolean | undefined;
        blockers[0]?.({ url }, (response) => (cancel = response.cancel));
        return cancel;
      },
    );

    expect(blockers).toHaveLength(1);
    expect(decisions).toEqual([false, true]);
    expect(session.setPermissionRequestHandler).toHaveBeenCalledOnce();
  });

  it("destroys the window and keeps rendering after a print failure", async () => {
    const { dependencies, windows } = createDependencies();
    const renderer = new ElectronPdfRenderer(dependencies);
    dependencies.createWindow.mockImplementationOnce(() => {
      const window = {
        loadURL: vi.fn(async () => undefined),
        destroy: vi.fn(),
        isDestroyed: () => false,
        printToPDF: vi.fn(async () => {
          throw new Error("print failed");
        }),
      };
      windows.push(window);
      return { ...window, webContents: { printToPDF: window.printToPDF } } as never;
    });

    await expect(renderer.htmlToPdf("<p>Ada</p>")).rejects.toThrow("print failed");
    await expect(renderer.htmlToPdf("<p>Grace</p>")).resolves.toEqual(Buffer.from("%PDF"));
    expect(windows[0]?.destroy).toHaveBeenCalled();
  });

  it("renders one document at a time", async () => {
    const { dependencies } = createDependencies();
    let releaseFirst!: () => void;
    const order: string[] = [];
    let opened = 0;
    dependencies.createWindow.mockImplementation(() => {
      const index = opened++;
      order.push(`open-${index}`);
      return {
        loadURL: vi.fn(async () => undefined),
        destroy: vi.fn(() => order.push(`close-${index}`)),
        isDestroyed: () => false,
        webContents: {
          printToPDF: vi.fn(
            () =>
              new Promise<Buffer>((resolve) => {
                if (index === 0) releaseFirst = () => resolve(Buffer.from("first"));
                else resolve(Buffer.from("second"));
              }),
          ),
        },
      } as never;
    });
    const renderer = new ElectronPdfRenderer(dependencies);

    const first = renderer.htmlToPdf("<p>1</p>");
    const second = renderer.htmlToPdf("<p>2</p>");
    await vi.waitFor(() => expect(order).toEqual(["open-0"]));
    releaseFirst();
    await Promise.all([first, second]);

    expect(order).toEqual(["open-0", "close-0", "open-1", "close-1"]);
  });
});
