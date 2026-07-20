import { describe, expect, it } from "vitest";
import { DesktopNotificationActivationQueue } from "./desktop-notification-activation.js";

describe("DesktopNotificationActivationQueue", () => {
  it("deduplicates clicks until the authenticated renderer consumes them", () => {
    const queue = new DesktopNotificationActivationQueue();

    queue.add({ notificationId: "notification-1", jobApplicationId: "application-1" });
    queue.add({ notificationId: "notification-1", jobApplicationId: "application-1" });
    queue.add({ notificationId: "notification-2" });

    expect(queue.takeAll()).toEqual([
      { notificationId: "notification-1", jobApplicationId: "application-1" },
      { notificationId: "notification-2" },
    ]);
    expect(queue.takeAll()).toEqual([]);
  });
});
