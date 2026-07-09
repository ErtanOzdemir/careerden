import type { CreateNotificationInput, Notification } from "./notification.js";

export interface NotificationRepository {
  create(input: CreateNotificationInput): Promise<Notification>;
  findById(id: string): Promise<Notification | null>;
  listByProfileId(profileId: string): Promise<Notification[]>;
  countUnreadByProfileId(profileId: string): Promise<number>;
  markRead(id: string): Promise<Notification | null>;
  markAllRead(profileId: string): Promise<void>;
}
