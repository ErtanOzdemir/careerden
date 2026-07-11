import { describe, expect, it } from "vitest";
import { MarkAllNotificationsReadUseCase } from "./mark-all-notifications-read.use-case.js";
import {
  createCurrentProfileProvider,
  createNotificationRepository,
} from "./notification-test-helpers.js";

describe("MarkAllNotificationsReadUseCase", () => {
  it("marks all notifications for the current user's profile as read", async () => {
    const notifications = createNotificationRepository();

    await new MarkAllNotificationsReadUseCase(
      notifications,
      createCurrentProfileProvider(),
    ).execute({ id: "user-1", name: "Ada Lovelace", email: "ada@example.com" });

    expect(notifications.markAllRead).toHaveBeenCalledWith("profile-1");
  });
});
