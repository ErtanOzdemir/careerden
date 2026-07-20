import { describe, expect, it, vi } from "vitest";
import type { NotificationChangeDto } from "@link2cv/contracts";
import type { DesktopNativeNotification } from "./native-notification-presenter.js";
import { NativeNotificationPresenter } from "./native-notification-presenter.js";

describe("NativeNotificationPresenter", () => {
  it("shows only the native-safe summary and activates the related application on click", () => {
    const nativeNotification = new FakeNativeNotification();
    const createNotification = vi.fn(() => nativeNotification);
    const onActivate = vi.fn();
    const presenter = new NativeNotificationPresenter({ createNotification, onActivate });

    expect(presenter.show(createChange())).toBe(true);
    expect(createNotification).toHaveBeenCalledWith({
      body: "It is time to follow up on Acme - Engineer.",
      title: "Send a follow-up",
    });
    expect(createNotification.mock.calls[0]?.[0].body).not.toContain(
      "Private reminder description",
    );
    expect(nativeNotification.show).toHaveBeenCalledOnce();

    nativeNotification.click();

    expect(onActivate).toHaveBeenCalledWith({
      notificationId: "notification-1",
      jobApplicationId: "application-1",
    });
  });

  it("does nothing when native notifications are unsupported", () => {
    const presenter = new NativeNotificationPresenter({
      createNotification: vi.fn(() => null),
      onActivate: vi.fn(),
    });

    expect(presenter.show(createChange())).toBe(false);
  });

  it("closes retained notifications during desktop shutdown", () => {
    const nativeNotification = new FakeNativeNotification();
    const presenter = new NativeNotificationPresenter({
      createNotification: () => nativeNotification,
      onActivate: vi.fn(),
    });
    presenter.show(createChange());

    presenter.closeAll();

    expect(nativeNotification.close).toHaveBeenCalledOnce();
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
      body: "Private reminder description",
      createdAt: new Date("2026-07-20T12:00:00.000Z"),
    },
    summary: "It is time to follow up on Acme - Engineer.",
  };
}

class FakeNativeNotification implements DesktopNativeNotification {
  readonly close = vi.fn();
  readonly show = vi.fn();
  private clickListener?: () => void;
  private closeListener?: () => void;
  private failedListener?: (error: string) => void;

  onClick(listener: () => void): void {
    this.clickListener = listener;
  }

  onClose(listener: () => void): void {
    this.closeListener = listener;
  }

  onFailed(listener: (error: string) => void): void {
    this.failedListener = listener;
  }

  click(): void {
    this.clickListener?.();
  }
}
