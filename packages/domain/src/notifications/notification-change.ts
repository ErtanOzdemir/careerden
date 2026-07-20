import type { Notification } from "./notification.js";

export interface NotificationCreatedChange {
  type: "notification.created";
  notification: Notification;
  summary: string;
}

export type NotificationChange = NotificationCreatedChange;

export type NotificationChangeListener = (change: NotificationChange) => void;

export interface NotificationChangePublisher {
  publish(change: NotificationChange): Promise<void>;
}

export interface NotificationChangeRecorder {
  created(notification: Notification, summary: string): Promise<void>;
}

export interface NotificationChangeSubscriber {
  subscribe(profileId: string, listener: NotificationChangeListener): Promise<() => void>;
}
