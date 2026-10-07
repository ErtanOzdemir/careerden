import { describe, expect, it } from "vitest";
import { CountUnreadNotificationsUseCase } from "./count-unread-notifications.use-case.js";
import {
  createCurrentProfileProvider,
  createNotificationRepository,
} from "./notification-test-helpers.js";

describe("CountUnreadNotificationsUseCase", () => {
  it("counts unread notifications for the current user's profile", async () => {
    const notifications = createNotificationRepository();

    await expect(
      new CountUnreadNotificationsUseCase(notifications, createCurrentProfileProvider()).execute({
        id: "user-1",
        name: "Ada Lovelace",
        email: "ada@example.com",
      }),
    ).resolves.toBe(1);
    expect(notifications.countUnreadByProfileId).toHaveBeenCalledWith("profile-1");
  });
});
