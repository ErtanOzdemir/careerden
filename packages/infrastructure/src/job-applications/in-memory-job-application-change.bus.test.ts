import { afterEach, describe, expect, it, vi } from "vitest";
import type { JobApplicationChange } from "@careerden/domain";
import { InMemoryJobApplicationChangeBus } from "./in-memory-job-application-change.bus.js";

const change: JobApplicationChange = {
  type: "application.changed",
  applicationId: "application-1",
  profileId: "profile-1",
  occurredAt: "2026-10-29T10:00:00.000Z",
};

describe("InMemoryJobApplicationChangeBus", () => {
  afterEach(() => vi.restoreAllMocks());

  it("delivers changes only to listeners of the change's profile", async () => {
    const bus = new InMemoryJobApplicationChangeBus();
    const own = vi.fn();
    const other = vi.fn();
    await bus.subscribe("profile-1", own);
    await bus.subscribe("profile-2", other);

    await bus.publish(change);

    expect(own).toHaveBeenCalledWith(change);
    expect(other).not.toHaveBeenCalled();
  });

  it("stops delivering after unsubscribe and close", async () => {
    const bus = new InMemoryJobApplicationChangeBus();
    const unsubscribed = vi.fn();
    const closed = vi.fn();
    const unsubscribe = await bus.subscribe("profile-1", unsubscribed);
    await bus.subscribe("profile-1", closed);

    unsubscribe();
    await bus.publish(change);
    await bus.close();
    await bus.publish(change);

    expect(unsubscribed).not.toHaveBeenCalled();
    expect(closed).toHaveBeenCalledOnce();
  });

  it("isolates listener failures from the publisher and other listeners", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const bus = new InMemoryJobApplicationChangeBus();
    const healthy = vi.fn();
    await bus.subscribe("profile-1", () => {
      throw new Error("stream closed");
    });
    await bus.subscribe("profile-1", healthy);

    await expect(bus.publish(change)).resolves.toBeUndefined();
    expect(healthy).toHaveBeenCalledOnce();
  });

  it("hands each listener its own copy of the change", async () => {
    const bus = new InMemoryJobApplicationChangeBus();
    const received: JobApplicationChange[] = [];
    await bus.subscribe("profile-1", (delivered) => {
      delivered.applicationId = "mutated";
    });
    await bus.subscribe("profile-1", (delivered) => received.push(delivered));

    await bus.publish(change);

    expect(received[0]?.applicationId).toBe("application-1");
    expect(change.applicationId).toBe("application-1");
  });
});
