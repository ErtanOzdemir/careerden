export type NotificationType = "follow_up_reminder";

export interface Notification {
  id: string;
  profileId: string;
  jobApplicationId?: string;
  type: NotificationType;
  title: string;
  body?: string;
  readAt?: Date;
  createdAt: Date;
}

export interface CreateNotificationInput {
  profileId: string;
  jobApplicationId?: string;
  type: NotificationType;
  title: string;
  body?: string;
}
