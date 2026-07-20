import { afterEach, describe, expect, it, vi } from "vitest";
import type { NotificationChangeDto } from "@link2cv/contracts";
import {
  DesktopNotificationStream,
  getDesktopNotificationRetryDelayMs,
} from "./desktop-notification-stream.js";

describe("DesktopNotificationStream", () => {
  const streams: DesktopNotificationStream[] = [];

  afterEach(async () => {
    await Promise.all(streams.splice(0).map((stream) => stream.stop()));
    vi.restoreAllMocks();
  });

  it("parses chunked SSE changes, validates them, and deduplicates notification ids", async () => {
    const onChange = vi.fn<(change: NotificationChangeDto) => void>();
    const payload = JSON.stringify(createChange());
    const fetch = vi.fn(async () =>
      createResponse([
        ": connected\r\n\r\n",
        "event: notification.created\r\n",
        `data: ${payload.slice(0, 50)}`,
        `${payload.slice(50)}\r\n\r\n`,
        `event: notification.created\ndata: ${payload}\n\n`,
        'event: notification.created\ndata: {"invalid":true}\n\n',
      ]),
    );
    const stream = new DesktopNotificationStream({
      apiBaseUrl: "http://127.0.0.1:3000/",
      fetch,
      onChange,
    });
    streams.push(stream);

    stream.start();

    await vi.waitFor(() => expect(onChange).toHaveBeenCalledOnce());
    expect(onChange).toHaveBeenCalledWith({
      ...createChange(),
      notification: expect.objectContaining({
        createdAt: new Date("2026-07-20T12:00:00.000Z"),
      }),
    });
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:3000/notifications/stream",
      expect.objectContaining({
        credentials: "include",
        headers: { Accept: "text/event-stream" },
        method: "GET",
      }),
    );
  });

  it("waits for an auth-cookie wake after an unauthorized response", async () => {
    const onChange = vi.fn();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(createResponse([createEvent(createChange())], true));
    const stream = new DesktopNotificationStream({
      apiBaseUrl: "http://127.0.0.1:3000",
      fetch,
      onChange,
    });
    streams.push(stream);

    stream.start();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    await Promise.resolve();
    expect(fetch).toHaveBeenCalledOnce();

    stream.wake();

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledOnce());
  });

  it("disables an incompatible stream endpoint without retrying", async () => {
    const onError = vi.fn();
    const fetch = vi.fn(async () => new Response(null, { status: 404 }));
    const stream = new DesktopNotificationStream({
      apiBaseUrl: "http://127.0.0.1:3000",
      fetch,
      onChange: vi.fn(),
      onError,
    });
    streams.push(stream);

    stream.start();

    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        message: "The Link2CV API does not support desktop notification streaming",
      }),
    );
  });

  it("caps exponential reconnect delays", () => {
    expect([0, 1, 2, 3, 4, 10].map(getDesktopNotificationRetryDelayMs)).toEqual([
      1_000, 2_000, 5_000, 10_000, 30_000, 30_000,
    ]);
  });
});

function createChange() {
  return {
    type: "notification.created" as const,
    notification: {
      id: "notification-1",
      profileId: "profile-1",
      jobApplicationId: "application-1",
      type: "follow_up_reminder" as const,
      title: "Send a follow-up",
      body: "Private reminder description",
      createdAt: "2026-07-20T12:00:00.000Z",
    },
    summary: "It is time to follow up on Acme - Engineer.",
  };
}

function createEvent(change: ReturnType<typeof createChange>): string {
  return `event: notification.created\ndata: ${JSON.stringify(change)}\n\n`;
}

function createResponse(chunks: string[], remainOpen = false): Response {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        if (!remainOpen) controller.close();
      },
    }),
    {
      headers: { "Content-Type": "text/event-stream" },
      status: 200,
    },
  );
}
