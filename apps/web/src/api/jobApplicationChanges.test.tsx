import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useJobApplicationChanges } from "./jobApplicationChanges.js";

describe("useJobApplicationChanges", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("resynchronizes on reconnect without reloading on the initial connection", () => {
    const onReconnect = vi.fn();
    const { unmount } = renderHook(() =>
      useJobApplicationChanges("profile-1", { onChange: vi.fn(), onReconnect }),
    );
    const source = MockEventSource.instances[0]!;

    act(() => source.open());
    expect(onReconnect).not.toHaveBeenCalled();

    act(() => source.open());
    expect(onReconnect).toHaveBeenCalledOnce();

    unmount();
    expect(source.close).toHaveBeenCalledOnce();
  });
});

class MockEventSource extends EventTarget {
  static instances: MockEventSource[] = [];
  onopen: (() => void) | null = null;
  close = vi.fn();

  constructor(_url: string | URL, _eventSourceInitDict?: EventSourceInit) {
    super();
    MockEventSource.instances.push(this);
  }

  open(): void {
    this.onopen?.();
  }
}
