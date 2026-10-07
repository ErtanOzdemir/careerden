import { describe, expect, it, vi } from "vitest";
import { ApplicationError } from "@careerden/application";
import { MarkNotificationReadUseCase } from "./mark-notification-read.use-case.js";
import {
  createCurrentProfileProvider,
  createNotificationRepository,
  createTestNotification,
} from "./notification-test-helpers.js";

const user = { id: "user-1", name: "Ada Lovelace", email: "ada@example.com" };

describe("MarkNotificationReadUseCase", () => {
  it("marks a notification owned by the current user's profile as read", async () => {
    const notifications = createNotificationRepository();

    await new MarkNotificationReadUseCase(notifications, createCurrentProfileProvider()).execute(
      "notification-1",
      user,
    );

    expect(notifications.markRead).toHaveBeenCalledWith("notification-1");
  });

  it("hides notifications belonging to another profile", async () => {
    const notification = { ...createTestNotification(), profileId: "profile-2" };
    const notifications = createNotificationRepository(notification);

    await expect(
      new MarkNotificationReadUseCase(notifications, createCurrentProfileProvider()).execute(
        notification.id,
        user,
      ),
    ).rejects.toEqual(new ApplicationError("not_found", "Notification not found"));
    expect(notifications.markRead).not.toHaveBeenCalled();
  });

  it("reports a notification removed between lookup and update as missing", async () => {
    const notifications = createNotificationRepository();
    vi.mocked(notifications.markRead).mockResolvedValue(null);

    await expect(
      new MarkNotificationReadUseCase(notifications, createCurrentProfileProvider()).execute(
        "notification-1",
        user,
      ),
    ).rejects.toEqual(new ApplicationError("not_found", "Notification not found"));
  });
});
