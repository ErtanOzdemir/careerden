import { describe, expect, it, vi } from "vitest";
import type { NotificationChangeDto } from "@careerden/contracts";
import { DesktopNotificationCoordinator } from "./desktop-notification-coordinator.js";

describe("DesktopNotificationCoordinator", () => {
  it("refreshes the renderer without an OS alert while the window is focused", () => {
    const notifyRenderer = vi.fn();
    const showNativeNotification = vi.fn();
    const coordinator = new DesktopNotificationCoordinator({
      getWindow: () => ({ isFocused: () => true, notifyRenderer }),
      showNativeNotification,
    });

    coordinator.received(createChange());

    expect(notifyRenderer).toHaveBeenCalledOnce();
    expect(showNativeNotification).not.toHaveBeenCalled();
  });

  it("refreshes the renderer and shows an OS alert while the window is unfocused", () => {
    const notifyRenderer = vi.fn();
    const showNativeNotification = vi.fn();
    const coordinator = new DesktopNotificationCoordinator({
      getWindow: () => ({ isFocused: () => false, notifyRenderer }),
      showNativeNotification,
    });

    coordinator.received(createChange());

    expect(notifyRenderer).toHaveBeenCalledOnce();
    expect(showNativeNotification).toHaveBeenCalledWith(createChange());
  });

  it("shows an OS alert when there is no open window", () => {
    const showNativeNotification = vi.fn();
    const coordinator = new DesktopNotificationCoordinator({
      getWindow: () => null,
      showNativeNotification,
    });

    coordinator.received(createChange());

    expect(showNativeNotification).toHaveBeenCalledOnce();
  });
});

function createChange(): NotificationChangeDto {
  return {
    type: "notification.created",
    notification: {
      id: "notification-1",
      profileId: "profile-1",
      jobApplicationId: "application-1",
      type: "follow_up_reminder",
      title: "Send a follow-up",
      createdAt: new Date("2026-07-20T12:00:00.000Z"),
    },
    summary: "It is time to follow up on Acme - Engineer.",
  };
}
