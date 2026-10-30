import type { NotificationChangeDto } from "@careerden/contracts";

export interface DesktopNotificationWindow {
  notifyRenderer(): void;
}

// Refreshes the renderer and raises an operating-system alert for every new notification,
// including while Careerden is in front, so reminders are noticed wherever the user is looking.
export class DesktopNotificationCoordinator {
  constructor(
    private readonly options: {
      getWindow: () => DesktopNotificationWindow | null;
      showNativeNotification: (change: NotificationChangeDto) => void;
    },
  ) {}

  received(change: NotificationChangeDto): void {
    this.options.getWindow()?.notifyRenderer();
    this.options.showNativeNotification(change);
  }
}
