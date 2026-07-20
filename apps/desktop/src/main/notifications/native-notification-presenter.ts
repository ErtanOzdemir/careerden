import type { NotificationChangeDto } from "@link2cv/contracts";
import type { DesktopNotificationActivation } from "./desktop-notification-activation.js";

export interface DesktopNativeNotification {
  close(): void;
  onClick(listener: () => void): void;
  onClose(listener: () => void): void;
  onFailed(listener: (error: string) => void): void;
  show(): void;
}

export type DesktopNativeNotificationFactory = (options: {
  body: string;
  title: string;
}) => DesktopNativeNotification | null;

export class NativeNotificationPresenter {
  private readonly activeNotifications = new Map<string, DesktopNativeNotification>();

  constructor(
    private readonly options: {
      createNotification: DesktopNativeNotificationFactory;
      onActivate: (activation: DesktopNotificationActivation) => void;
      onError?: (error: unknown) => void;
    },
  ) {}

  show(change: NotificationChangeDto): boolean {
    const notificationId = change.notification.id;
    let nativeNotification: DesktopNativeNotification | null = null;

    try {
      nativeNotification = this.options.createNotification({
        body: change.summary,
        title: change.notification.title,
      });

      if (!nativeNotification) return false;

      this.activeNotifications.get(notificationId)?.close();
      this.activeNotifications.set(notificationId, nativeNotification);

      const release = () => {
        if (this.activeNotifications.get(notificationId) === nativeNotification) {
          this.activeNotifications.delete(notificationId);
        }
      };

      nativeNotification.onClick(() => {
        release();
        this.options.onActivate({
          notificationId,
          ...(change.notification.jobApplicationId
            ? { jobApplicationId: change.notification.jobApplicationId }
            : {}),
        });
      });
      nativeNotification.onClose(release);
      nativeNotification.onFailed((error) => {
        release();
        this.options.onError?.(new Error(`Failed to show native notification: ${error}`));
      });

      nativeNotification.show();
      return true;
    } catch (error) {
      if (
        nativeNotification &&
        this.activeNotifications.get(notificationId) === nativeNotification
      ) {
        this.activeNotifications.delete(notificationId);
      }
      this.options.onError?.(error);
      return false;
    }
  }

  closeAll(): void {
    const notifications = [...this.activeNotifications.values()];
    this.activeNotifications.clear();

    for (const notification of notifications) {
      try {
        notification.close();
      } catch (error) {
        this.options.onError?.(error);
      }
    }
  }
}
