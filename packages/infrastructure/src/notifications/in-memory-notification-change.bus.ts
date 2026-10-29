import type {
  NotificationChange,
  NotificationChangeListener,
  NotificationChangePublisher,
  NotificationChangeSubscriber,
} from "@careerden/domain";

// Single-process replacement for the Redis bus when the API and its background work share a process.
export class InMemoryNotificationChangeBus
  implements NotificationChangePublisher, NotificationChangeSubscriber
{
  private readonly listeners = new Map<string, Set<NotificationChangeListener>>();

  async publish(change: NotificationChange): Promise<void> {
    for (const listener of [...(this.listeners.get(change.notification.profileId) ?? [])]) {
      try {
        listener(structuredClone(change));
      } catch (error) {
        console.error("Notification change listener failed", error);
      }
    }
  }

  async subscribe(profileId: string, listener: NotificationChangeListener): Promise<() => void> {
    const listeners = this.listeners.get(profileId) ?? new Set<NotificationChangeListener>();
    listeners.add(listener);
    this.listeners.set(profileId, listeners);

    return () => {
      listeners.delete(listener);

      if (listeners.size === 0) {
        this.listeners.delete(profileId);
      }
    };
  }

  async close(): Promise<void> {
    this.listeners.clear();
  }
}
