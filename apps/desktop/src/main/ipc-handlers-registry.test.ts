import type { IpcMainInvokeEvent } from "electron";
import { describe, expect, it, vi } from "vitest";
import { IpcHandlerRegistry } from "./ipc-handlers-registry.js";

describe("IpcHandlerRegistry", () => {
  it("invokes a registered handler for a trusted sender", () => {
    const handle = vi.fn();
    const handler = vi.fn(() => "result");
    const event = {} as IpcMainInvokeEvent;

    new IpcHandlerRegistry({ handle }, (candidate) => candidate === event).register(
      "secure-channel",
      handler,
    );

    const registeredHandler = handle.mock.calls[0]?.[1];
    expect(registeredHandler?.(event, "payload")).toBe("result");
    expect(handler).toHaveBeenCalledWith(event, "payload");
  });

  it("rejects an untrusted sender before invoking the channel handler", () => {
    const handle = vi.fn();
    const handler = vi.fn();

    new IpcHandlerRegistry({ handle }, () => false).register("secure-channel", handler);

    const registeredHandler = handle.mock.calls[0]?.[1];
    expect(() => registeredHandler?.({} as IpcMainInvokeEvent)).toThrow(
      "IPC sender is not trusted",
    );
    expect(handler).not.toHaveBeenCalled();
  });
});
