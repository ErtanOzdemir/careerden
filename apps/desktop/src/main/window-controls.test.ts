import { describe, expect, it, vi } from "vitest";
import { applyWindowControl } from "./window-controls.js";

function createWindowStub(isMaximized = false) {
  return {
    close: vi.fn(),
    isMaximized: vi.fn(() => isMaximized),
    maximize: vi.fn(),
    minimize: vi.fn(),
    unmaximize: vi.fn(),
  };
}

describe("applyWindowControl", () => {
  it("minimizes the window", () => {
    const window = createWindowStub();

    applyWindowControl(window as never, "minimize");

    expect(window.minimize).toHaveBeenCalledOnce();
  });

  it("toggles maximize and restore", () => {
    const normalWindow = createWindowStub(false);
    const maximizedWindow = createWindowStub(true);

    applyWindowControl(normalWindow as never, "toggle-maximize");
    applyWindowControl(maximizedWindow as never, "toggle-maximize");

    expect(normalWindow.maximize).toHaveBeenCalledOnce();
    expect(maximizedWindow.unmaximize).toHaveBeenCalledOnce();
  });

  it("closes the window", () => {
    const window = createWindowStub();

    applyWindowControl(window as never, "close");

    expect(window.close).toHaveBeenCalledOnce();
  });
});
