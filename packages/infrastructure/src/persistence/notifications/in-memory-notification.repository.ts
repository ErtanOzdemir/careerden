import type {
  CreateNotificationInput,
  Notification,
  NotificationRepository,
} from "@link2cv/domain";
import { randomUUID } from "node:crypto";

export class InMemoryNotificationRepository implements NotificationRepository {
  private readonly notifications = new Map<string, Notification>();

  async create(input: CreateNotificationInput): Promise<Notification> {
    const notification: Notification = {
      id: randomUUID(),
      ...input,
      createdAt: new Date(),
    };

    this.notifications.set(notification.id, notification);
    return notification;
  }

  async findById(id: string): Promise<Notification | null> {
    return this.notifications.get(id) ?? null;
  }

  async listByProfileId(profileId: string): Promise<Notification[]> {
    return [...this.notifications.values()]
      .filter((notification) => notification.profileId === profileId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, 50);
  }

  async countUnreadByProfileId(profileId: string): Promise<number> {
    return [...this.notifications.values()].filter(
      (notification) => notification.profileId === profileId && !notification.readAt,
    ).length;
  }

  async markRead(id: string): Promise<Notification | null> {
    const existing = this.notifications.get(id);

    if (!existing) {
      return null;
    }

    const updated = { ...existing, readAt: new Date() };
    this.notifications.set(id, updated);
    return updated;
  }

  async markAllRead(profileId: string): Promise<void> {
    for (const notification of this.notifications.values()) {
      if (notification.profileId === profileId && !notification.readAt) {
        this.notifications.set(notification.id, { ...notification, readAt: new Date() });
      }
    }
  }
}
