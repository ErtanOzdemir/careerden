import { describe, expect, it, vi } from "vitest";
import type { JobApplicationChange } from "@careerden/domain";
import { RedisJobApplicationChangeBus } from "./redis-job-application-change.bus.js";

describe("RedisJobApplicationChangeBus", () => {
  it("publishes profile-scoped changes and filters subscriptions by profile", async () => {
    const broker = new FakeRedisBroker();
    const bus = new RedisJobApplicationChangeBus(broker.publisher, broker.subscriber);
    const firstProfileChanges: JobApplicationChange[] = [];
    const secondProfileChanges: JobApplicationChange[] = [];

    await bus.subscribe("profile-1", (change) => firstProfileChanges.push(change));
    await bus.subscribe("profile-2", (change) => secondProfileChanges.push(change));

    await bus.publish({
      type: "application.changed",
      applicationId: "job-1",
      profileId: "profile-1",
      occurredAt: "2026-06-28T12:00:00.000Z",
    });

    expect(firstProfileChanges).toEqual([
      {
        type: "application.changed",
        applicationId: "job-1",
        profileId: "profile-1",
        occurredAt: "2026-06-28T12:00:00.000Z",
      },
    ]);
    expect(secondProfileChanges).toEqual([]);
  });

  it("unsubscribes from Redis when the last profile listener is removed", async () => {
    const broker = new FakeRedisBroker();
    const bus = new RedisJobApplicationChangeBus(broker.publisher, broker.subscriber);
    const listener = vi.fn();

    const unsubscribe = await bus.subscribe("profile-1", listener);
    unsubscribe();
    await bus.publish({
      type: "application.changed",
      applicationId: "job-1",
      profileId: "profile-1",
      occurredAt: "2026-06-28T12:00:00.000Z",
    });

    expect(listener).not.toHaveBeenCalled();
    expect(broker.subscriber.unsubscribe).toHaveBeenCalledWith("job-application-changes");
  });
});

class FakeRedisBroker {
  readonly handlers = new Set<(channel: string, message: string) => void>();
  readonly publisher = {
    publish: vi.fn(async (channel: string, message: string) => {
      for (const handler of this.handlers) {
        handler(channel, message);
      }
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
}
