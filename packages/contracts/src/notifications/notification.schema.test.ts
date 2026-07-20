import { describe, expect, it } from "vitest";
import { notificationChangeSchema } from "./notification.schema.js";

describe("notificationChangeSchema", () => {
  it("parses a notification.created event from its JSON wire representation", () => {
    const result = notificationChangeSchema.parse({
      type: "notification.created",
      notification: {
        id: "notification-1",
        profileId: "profile-1",
        jobApplicationId: "application-1",
        type: "follow_up_reminder",
        title: "Follow up",
        body: "Full private reminder body",
        createdAt: "2026-07-20T12:00:00.000Z",
      },
      summary: "It is time to follow up on Acme - Engineer.",
    });

    expect(result.notification.createdAt).toEqual(new Date("2026-07-20T12:00:00.000Z"));
    expect(result.summary).toBe("It is time to follow up on Acme - Engineer.");
  });

  it("rejects malformed realtime events", () => {
    expect(
      notificationChangeSchema.safeParse({
        type: "notification.created",
        notification: { id: "notification-1" },
        summary: "",
      }).success,
    ).toBe(false);
  });
});
