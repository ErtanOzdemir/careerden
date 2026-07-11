import { describe, expect, it, vi } from "vitest";
import type { JobApplicationChangePublisher } from "@link2cv/domain";
import { JobApplicationChangeNotifier } from "./job-application-change.notifier.js";

describe("JobApplicationChangeNotifier", () => {
  it("publishes changed and deleted notifications with the supplied time", async () => {
    const publish = vi.fn<JobApplicationChangePublisher["publish"]>();
    const notifier = new JobApplicationChangeNotifier(
      { publish },
      () => new Date("2026-07-11T12:00:00.000Z"),
    );

    await notifier.changed("application-1", "profile-1");
    await notifier.deleted("application-1", "profile-1");

    expect(publish.mock.calls).toEqual([
      [
        {
          type: "application.changed",
          applicationId: "application-1",
          profileId: "profile-1",
          occurredAt: "2026-07-11T12:00:00.000Z",
        },
      ],
      [
        {
          type: "application.deleted",
          applicationId: "application-1",
          profileId: "profile-1",
          occurredAt: "2026-07-11T12:00:00.000Z",
        },
      ],
    ]);
  });

  it("does not fail a completed operation when publication fails", async () => {
    const error = new Error("Realtime channel unavailable");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const notifier = new JobApplicationChangeNotifier({
      publish: vi.fn().mockRejectedValue(error),
    });

    await expect(notifier.changed("application-1", "profile-1")).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to publish job application realtime change",
      error,
    );

    consoleError.mockRestore();
  });
});
