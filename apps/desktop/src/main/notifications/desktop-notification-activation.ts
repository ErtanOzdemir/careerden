export interface DesktopNotificationActivation {
  notificationId: string;
  jobApplicationId?: string;
}

export class DesktopNotificationActivationQueue {
  private readonly activations = new Map<string, DesktopNotificationActivation>();

  add(activation: DesktopNotificationActivation): void {
    this.activations.set(activation.notificationId, activation);
  }

  takeAll(): DesktopNotificationActivation[] {
    const pending = [...this.activations.values()];
    this.activations.clear();
    return pending;
  }
}
