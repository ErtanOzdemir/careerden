import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { notificationsApi } from "../api/notifications.js";
import {
  DesktopNotificationBridge,
  notificationsChangedEventName,
} from "./DesktopNotificationBridge.js";

describe("DesktopNotificationBridge", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    delete window.electronAPI;
  });

  it("consumes a native click, opens the application timeline, and marks it read", async () => {
    const unsubscribeArrived = vi.fn();
    const unsubscribeActivation = vi.fn();
    const markRead = vi.spyOn(notificationsApi, "markRead").mockResolvedValue({} as never);
    window.electronAPI = createElectronApi({
      consumePendingNativeNotificationActivations: vi.fn(async () => [
        { notificationId: "notification-1", jobApplicationId: "application-1" },
      ]),
      onNotificationArrived: vi.fn(() => unsubscribeArrived),
      onNativeNotificationActivationAvailable: vi.fn(() => unsubscribeActivation),
    });

    const result = renderBridge();

    await waitFor(() => expect(markRead).toHaveBeenCalledWith("notification-1"));
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/applications/application-1?tab=timeline",
    );

    result.unmount();
    expect(unsubscribeArrived).toHaveBeenCalledOnce();
    expect(unsubscribeActivation).toHaveBeenCalledOnce();
  });

  it("turns a desktop arrival signal into an immediate web notification refresh event", () => {
    let arrived: (() => void) | undefined;
    const changed = vi.fn();
    window.addEventListener(notificationsChangedEventName, changed);
    window.electronAPI = createElectronApi({
      consumePendingNativeNotificationActivations: vi.fn(async () => []),
      onNotificationArrived: vi.fn((listener) => {
        arrived = listener;
        return vi.fn();
      }),
      onNativeNotificationActivationAvailable: vi.fn(() => vi.fn()),
    });
    renderBridge();

    act(() => arrived?.());

    expect(changed).toHaveBeenCalledOnce();
    window.removeEventListener(notificationsChangedEventName, changed);
  });
});

function renderBridge() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <DesktopNotificationBridge />
      <LocationProbe />
    </MemoryRouter>,
  );
}

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>;
}

function createElectronApi(
  overrides: Pick<
    NonNullable<Window["electronAPI"]>,
    | "consumePendingNativeNotificationActivations"
    | "onNativeNotificationActivationAvailable"
    | "onNotificationArrived"
  >,
): NonNullable<Window["electronAPI"]> {
  return {
    getLinkedInSessionStatus: vi.fn(),
    notifyJobApplicationQueued: vi.fn(),
    saveLinkedInSession: vi.fn(),
    startLinkedInSession: vi.fn(),
    ...overrides,
  };
}
