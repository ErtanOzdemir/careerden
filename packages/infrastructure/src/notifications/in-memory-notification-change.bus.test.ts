import { afterEach, describe, expect, it, vi } from "vitest";
import type { NotificationChange } from "@careerden/domain";
import { InMemoryNotificationChangeBus } from "./in-memory-notification-change.bus.js";

const change: NotificationChange = {
  type: "notification.created",
  notification: {
    id: "notification-1",
    profileId: "profile-1",
    type: "follow_up_reminder",
    title: "Follow up",
    createdAt: new Date("2026-10-29T10:00:00.000Z"),
  },
  summary: "It is time to follow up on Acme - Engineer.",
};

describe("InMemoryNotificationChangeBus", () => {
  afterEach(() => vi.restoreAllMocks());

  it("delivers notifications only to listeners of the notification's profile", async () => {
    const bus = new InMemoryNotificationChangeBus();
    const own = vi.fn();
    const other = vi.fn();
    await bus.subscribe("profile-1", own);
    await bus.subscribe("profile-2", other);

    await bus.publish(change);

    expect(own).toHaveBeenCalledWith(change);
    expect(other).not.toHaveBeenCalled();
  });

  it("stops delivering after unsubscribe", async () => {
    const bus = new InMemoryNotificationChangeBus();
    const listener = vi.fn();
    const unsubscribe = await bus.subscribe("profile-1", listener);

    unsubscribe();
    await bus.publish(change);

    expect(listener).not.toHaveBeenCalled();
  });

  it("isolates listener failures from the publisher", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const bus = new InMemoryNotificationChangeBus();
    await bus.subscribe("profile-1", () => {
      throw new Error("stream closed");
    });

    await expect(bus.publish(change)).resolves.toBeUndefined();
  });
});
