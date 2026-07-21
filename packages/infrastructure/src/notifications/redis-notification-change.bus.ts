import { Redis } from "ioredis";
import { notificationChangeSchema } from "@careerden/contracts";
import type {
  NotificationChange,
  NotificationChangeListener,
  NotificationChangePublisher,
  NotificationChangeSubscriber,
} from "@careerden/domain";

const defaultChannel = "notification-changes";

export interface RedisNotificationChangeClient {
  publish(channel: string, message: string): Promise<unknown>;
  quit(): Promise<unknown>;
}

export interface RedisNotificationChangeSubscriberClient {
  subscribe(channel: string): Promise<unknown>;
  unsubscribe(channel: string): Promise<unknown>;
  on(event: "message", handler: (channel: string, message: string) => void): unknown;
  off(event: "message", handler: (channel: string, message: string) => void): unknown;
  quit(): Promise<unknown>;
}

export class RedisNotificationChangeBus
  implements NotificationChangePublisher, NotificationChangeSubscriber
{
  private readonly listeners = new Map<string, Set<NotificationChangeListener>>();
  private subscribed = false;

  constructor(
    private readonly publisher: RedisNotificationChangeClient,
    private readonly subscriber: RedisNotificationChangeSubscriberClient,
    private readonly channel = defaultChannel,
  ) {}

  static create(redisUrl: string): RedisNotificationChangeBus {
    return new RedisNotificationChangeBus(new Redis(redisUrl), new Redis(redisUrl));
  }

  async publish(change: NotificationChange): Promise<void> {
    await this.publisher.publish(this.channel, JSON.stringify(change));
  }

  async subscribe(profileId: string, listener: NotificationChangeListener): Promise<() => void> {
    if (!this.subscribed) {
      this.subscriber.on("message", this.handleMessage);
      await this.subscriber.subscribe(this.channel);
      this.subscribed = true;
    }

    const listeners = this.listeners.get(profileId) ?? new Set<NotificationChangeListener>();
    listeners.add(listener);
    this.listeners.set(profileId, listeners);

    return () => {
      listeners.delete(listener);

      if (listeners.size === 0) {
        this.listeners.delete(profileId);
      }

      if (this.listeners.size === 0 && this.subscribed) {
        this.subscriber.off("message", this.handleMessage);
        void this.subscriber.unsubscribe(this.channel);
        this.subscribed = false;
      }
    };
  }

  async close(): Promise<void> {
    if (this.subscribed) {
      this.subscriber.off("message", this.handleMessage);
      await this.subscriber.unsubscribe(this.channel);
      this.subscribed = false;
    }

    await Promise.all([this.publisher.quit(), this.subscriber.quit()]);
  }

  private readonly handleMessage = (channel: string, message: string): void => {
    if (channel !== this.channel) {
      return;
    }

    const change = parseNotificationChange(message);

    if (!change) {
      return;
    }

    for (const listener of this.listeners.get(change.notification.profileId) ?? []) {
      listener(change);
    }
  };
}

function parseNotificationChange(message: string): NotificationChange | null {
  try {
    const result = notificationChangeSchema.safeParse(JSON.parse(message));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
