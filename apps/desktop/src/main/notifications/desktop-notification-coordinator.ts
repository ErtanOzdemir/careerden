import type { NotificationChangeDto } from "@link2cv/contracts";

export interface DesktopNotificationWindow {
  isFocused(): boolean;
  notifyRenderer(): void;
}

export class DesktopNotificationCoordinator {
  constructor(
    private readonly options: {
      getWindow: () => DesktopNotificationWindow | null;
      showNativeNotification: (change: NotificationChangeDto) => void;
    },
  ) {}

  received(change: NotificationChangeDto): void {
    const window = this.options.getWindow();
    window?.notifyRenderer();

    if (!window?.isFocused()) {
      this.options.showNativeNotification(change);
    }
  }
}
