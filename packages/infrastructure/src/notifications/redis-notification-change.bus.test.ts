import { describe, expect, it, vi } from "vitest";
import type { NotificationChange } from "@link2cv/domain";
import { RedisNotificationChangeBus } from "./redis-notification-change.bus.js";

describe("RedisNotificationChangeBus", () => {
  it("publishes parsed changes only to listeners for the owning profile", async () => {
    const broker = new FakeRedisBroker();
    const bus = new RedisNotificationChangeBus(broker.publisher, broker.subscriber);
    const firstProfileChanges: NotificationChange[] = [];
    const secondProfileChanges: NotificationChange[] = [];

    await bus.subscribe("profile-1", (change) => firstProfileChanges.push(change));
    await bus.subscribe("profile-2", (change) => secondProfileChanges.push(change));

    await bus.publish(createChange());

    expect(firstProfileChanges).toEqual([createChange()]);
    expect(secondProfileChanges).toEqual([]);
  });

  it("ignores malformed messages and unsubscribes after the last listener is removed", async () => {
    const broker = new FakeRedisBroker();
    const bus = new RedisNotificationChangeBus(broker.publisher, broker.subscriber);
    const listener = vi.fn();

    const unsubscribe = await bus.subscribe("profile-1", listener);
    broker.emit("notification-changes", JSON.stringify({ type: "notification.created" }));
    unsubscribe();
    await bus.publish(createChange());

    expect(listener).not.toHaveBeenCalled();
    expect(broker.subscriber.unsubscribe).toHaveBeenCalledWith("notification-changes");
  });
});

function createChange(): NotificationChange {
  return {
    type: "notification.created",
    notification: {
      id: "notification-1",
      profileId: "profile-1",
      jobApplicationId: "application-1",
      type: "follow_up_reminder",
      title: "Follow up",
      body: "Full private reminder body",
      createdAt: new Date("2026-07-20T12:00:00.000Z"),
    },
    summary: "It is time to follow up on Acme - Engineer.",
  };
}

class FakeRedisBroker {
  readonly handlers = new Set<(channel: string, message: string) => void>();
  readonly publisher = {
    publish: vi.fn(async (channel: string, message: string) => {
      this.emit(channel, message);
    }),
    quit: vi.fn(async () => undefined),
  };
  readonly subscriber = {
    subscribe: vi.fn(async () => undefined),
    unsubscribe: vi.fn(async () => undefined),
    on: vi.fn((event: string, handler: (channel: string, message: string) => void) => {
      if (event === "message") {
        this.handlers.add(handler);
      }
      return this.subscriber;
    }),
    off: vi.fn((event: string, handler: (channel: string, message: string) => void) => {
      if (event === "message") {
        this.handlers.delete(handler);
      }
      return this.subscriber;
    }),
    quit: vi.fn(async () => undefined),
  };

  emit(channel: string, message: string): void {
    for (const handler of this.handlers) {
      handler(channel, message);
    }
  }
}
