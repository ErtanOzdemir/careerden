import { afterEach, describe, expect, it, vi } from "vitest";
import type { JobApplicationChangePublisher, NotificationChangePublisher } from "@careerden/domain";
import type { Knex } from "knex";
import { PostgresPersistenceUnitOfWork } from "./postgres-persistence-unit-of-work.js";

describe("PostgresPersistenceUnitOfWork realtime changes", () => {
  afterEach(() => vi.restoreAllMocks());

  it("publishes recorded changes only after the transaction commits", async () => {
    let committed = false;
    const publish = vi.fn(async () => {
      expect(committed).toBe(true);
    });
    const unitOfWork = new PostgresPersistenceUnitOfWork(
      createDb(() => {
        committed = true;
      }),
      { publish },
    );

    await unitOfWork.execute(async ({ jobApplicationChanges }) => {
      await jobApplicationChanges.changed("application-1", "profile-1");
    });

    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "application.changed",
        applicationId: "application-1",
        profileId: "profile-1",
      }),
    );
  });

  it("publishes notification changes only after commit with their native-safe summary", async () => {
    let committed = false;
    const publish = vi.fn(async () => {
      expect(committed).toBe(true);
    });
    const unitOfWork = new PostgresPersistenceUnitOfWork(
      createDb(() => {
        committed = true;
      }),
      undefined,
      { publish },
    );

    await unitOfWork.execute(async ({ notificationChanges }) => {
      await notificationChanges.created(
        {
          id: "notification-1",
          profileId: "profile-1",
          type: "follow_up_reminder",
          title: "Follow up",
          createdAt: new Date("2026-07-20T12:00:00.000Z"),
        },
        "It is time to follow up on Acme - Engineer.",
      );
    });

    expect(publish).toHaveBeenCalledWith({
      type: "notification.created",
      notification: expect.objectContaining({ id: "notification-1", profileId: "profile-1" }),
      summary: "It is time to follow up on Acme - Engineer.",
    });
  });

  it("discards recorded changes when the transaction rolls back", async () => {
    const publish = vi.fn<JobApplicationChangePublisher["publish"]>();
    const publishNotification = vi.fn<NotificationChangePublisher["publish"]>();
    const unitOfWork = new PostgresPersistenceUnitOfWork(
      createDb(),
      { publish },
      { publish: publishNotification },
    );

    await expect(
      unitOfWork.execute(async ({ jobApplicationChanges, notificationChanges }) => {
        await jobApplicationChanges.changed("application-1", "profile-1");
        await notificationChanges.created(
          {
            id: "notification-1",
            profileId: "profile-1",
            type: "follow_up_reminder",
            title: "Follow up",
            createdAt: new Date(),
          },
          "It is time to follow up.",
        );
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");

    expect(publish).not.toHaveBeenCalled();
    expect(publishNotification).not.toHaveBeenCalled();
  });

  it("deduplicates notification changes and preserves a committed transaction on publish error", async () => {
    const publish = vi.fn(async () => {
      throw new Error("redis unavailable");
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const unitOfWork = new PostgresPersistenceUnitOfWork(createDb(), undefined, { publish });
    const notification = {
      id: "notification-1",
      profileId: "profile-1",
      type: "follow_up_reminder" as const,
      title: "Follow up",
      createdAt: new Date(),
    };

    await expect(
      unitOfWork.execute(async ({ notificationChanges }) => {
        await notificationChanges.created(notification, "It is time to follow up.");
        await notificationChanges.created(notification, "It is time to follow up.");
        return "committed";
      }),
    ).resolves.toBe("committed");

    expect(publish).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledWith(
      "Failed to publish notification realtime change",
      expect.any(Error),
    );
  });

  it("deduplicates identical changes and does not fail a committed transaction on publish error", async () => {
    const publish = vi.fn(async () => {
      throw new Error("redis unavailable");
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const unitOfWork = new PostgresPersistenceUnitOfWork(createDb(), { publish });

    await expect(
      unitOfWork.execute(async ({ jobApplicationChanges }) => {
        await jobApplicationChanges.changed("application-1", "profile-1");
        await jobApplicationChanges.changed("application-1", "profile-1");
        return "committed";
      }),
    ).resolves.toBe("committed");

    expect(publish).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledWith(
      "Failed to publish job application realtime change",
      expect.any(Error),
    );
  });
});

function createDb(afterCommit: () => void = () => undefined): Knex {
  return {
    transaction: vi.fn(async (work: (transaction: Knex.Transaction) => Promise<unknown>) => {
      const result = await work({} as Knex.Transaction);
      afterCommit();
      return result;
    }),
  } as unknown as Knex;
}
