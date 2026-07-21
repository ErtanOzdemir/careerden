import express from "express";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NotificationChange, NotificationChangeListener } from "@careerden/domain";
import type { AuthenticatedRequest } from "../auth/session.middleware.js";
import { createNotificationRouter } from "./notifications.routes.js";

describe("createNotificationRouter realtime stream", () => {
  const servers: Array<ReturnType<ReturnType<typeof express>["listen"]>> = [];

  afterEach(async () => {
    await Promise.all(
      servers
        .splice(0)
        .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
    );
  });

  it("streams only the authenticated user's profile notifications and cleans up", async () => {
    let listener: NotificationChangeListener | undefined;
    let markSubscribed!: () => void;
    const subscribed = new Promise<void>((resolve) => {
      markSubscribed = resolve;
    });
    const unsubscribe = vi.fn();
    const getCurrentProfile = {
      execute: vi.fn(async () => ({ id: "profile-1" })),
    };
    const notificationChanges = {
      publish: vi.fn(),
      subscribe: vi.fn(async (_profileId: string, next: NotificationChangeListener) => {
        listener = next;
        markSubscribed();
        return unsubscribe;
      }),
    };
    const app = express();
    app.use((request, _response, next) => {
      (request as AuthenticatedRequest).user = {
        id: "user-1",
        email: "ada@example.com",
        name: "Ada Lovelace",
      };
      next();
    });
    app.use(
      "/notifications",
      createNotificationRouter({
        listNotifications: {} as never,
        countUnreadNotifications: {} as never,
        markNotificationRead: {} as never,
        markAllNotificationsRead: {} as never,
        getCurrentProfile: getCurrentProfile as never,
        notificationChanges,
      }),
    );
    const server = app.listen(0, "127.0.0.1");
    servers.push(server);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const { port } = server.address() as AddressInfo;
    const controller = new AbortController();
    const response = await fetch(`http://127.0.0.1:${port}/notifications/stream`, {
      signal: controller.signal,
    });
    await subscribed;

    listener?.(createChange());
    const body = await readUntil(response, '"type":"notification.created"');

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(body).toContain("event: notification.created");
    expect(body).toContain("It is time to follow up on Acme - Engineer.");
    expect(notificationChanges.subscribe).toHaveBeenCalledWith("profile-1", expect.any(Function));
    expect(getCurrentProfile.execute).toHaveBeenCalledWith({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada Lovelace",
    });

    controller.abort();
    await vi.waitFor(() => expect(unsubscribe).toHaveBeenCalledOnce());
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

async function readUntil(response: Response, expected: string): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Expected an SSE response body");
  const decoder = new TextDecoder();
  let body = "";

  while (!body.includes(expected)) {
    const result = await reader.read();
    if (result.done) break;
    body += decoder.decode(result.value, { stream: true });
  }

  return body;
}
