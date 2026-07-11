import { describe, expect, it } from "vitest";
import {
  createCurrentProfileProvider,
  createNotificationRepository,
  createTestNotification,
} from "./notification-test-helpers.js";
import { ListNotificationsUseCase } from "./list-notifications.use-case.js";

describe("ListNotificationsUseCase", () => {
  it("lists notifications for the current user's profile", async () => {
    const notification = createTestNotification();
    const notifications = createNotificationRepository(notification);

    await expect(
      new ListNotificationsUseCase(notifications, createCurrentProfileProvider()).execute({
        id: "user-1",
        name: "Ada Lovelace",
        email: "ada@example.com",
      }),
    ).resolves.toEqual([notification]);
    expect(notifications.listByProfileId).toHaveBeenCalledWith("profile-1");
  });
});
