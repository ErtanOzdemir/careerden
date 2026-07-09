import { requestJson } from "./client";
import type { ApiNotification } from "./types";

export const notificationsApi = {
  list(): Promise<ApiNotification[]> {
    return requestJson<ApiNotification[]>("/notifications");
  },

  unreadCount(): Promise<{ count: number }> {
    return requestJson<{ count: number }>("/notifications/unread-count");
  },

  markRead(id: string): Promise<ApiNotification> {
    return requestJson<ApiNotification>(`/notifications/${id}/read`, {
      method: "PATCH",
    });
  },

  markAllRead(): Promise<void> {
    return requestJson<void>("/notifications/read-all", {
      method: "PATCH",
    });
  },
};
