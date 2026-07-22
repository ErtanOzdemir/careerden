import { describe, expect, it, vi } from "vitest";
import { NativeNotificationPermissionRequester } from "./native-notification-permission-requester.js";

describe("NativeNotificationPermissionRequester", () => {
  it("initializes supported macOS notifications only once", () => {
    const initialize = vi.fn();
    const requester = createRequester({ initialize });

    requester.request();
    requester.request();

    expect(initialize).toHaveBeenCalledOnce();
  });

  it("does nothing when notifications are unsupported", () => {
    const initialize = vi.fn();
    const requester = createRequester({ initialize, isSupported: () => false });

    requester.request();

    expect(initialize).not.toHaveBeenCalled();
  });

  it("does nothing outside macOS", () => {
    const initialize = vi.fn();
    const requester = createRequester({ initialize, platform: "win32" });

    requester.request();

    expect(initialize).not.toHaveBeenCalled();
  });

  it("reports initialization failures without throwing or retrying", () => {
    const error = new Error("authorization unavailable");
    const onError = vi.fn();
    const requester = createRequester({
      initialize: () => {
        throw error;
      },
      onError,
    });

    expect(() => requester.request()).not.toThrow();
    expect(() => requester.request()).not.toThrow();

    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(error);
  });
});

function createRequester(
  overrides: Partial<ConstructorParameters<typeof NativeNotificationPermissionRequester>[0]> = {},
): NativeNotificationPermissionRequester {
  return new NativeNotificationPermissionRequester({
    initialize: vi.fn(),
    isSupported: () => true,
    platform: "darwin",
    ...overrides,
  });
}
