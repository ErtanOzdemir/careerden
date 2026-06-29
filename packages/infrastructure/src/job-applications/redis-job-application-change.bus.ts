import { Redis } from "ioredis";
import type {
  JobApplicationChange,
  JobApplicationChangeListener,
  JobApplicationChangePublisher,
  JobApplicationChangeSubscriber,
} from "@link2cv/domain";

const defaultChannel = "job-application-changes";

export interface RedisJobApplicationChangeClient {
  publish(channel: string, message: string): Promise<unknown>;
  quit(): Promise<unknown>;
}

export interface RedisJobApplicationChangeSubscriberClient {
  subscribe(channel: string): Promise<unknown>;
  unsubscribe(channel: string): Promise<unknown>;
  on(event: "message", handler: (channel: string, message: string) => void): unknown;
  off(event: "message", handler: (channel: string, message: string) => void): unknown;
  quit(): Promise<unknown>;
}

export class RedisJobApplicationChangeBus
  implements JobApplicationChangePublisher, JobApplicationChangeSubscriber
{
  private readonly listeners = new Map<string, Set<JobApplicationChangeListener>>();
  private subscribed = false;

  constructor(
    private readonly publisher: RedisJobApplicationChangeClient,
    private readonly subscriber: RedisJobApplicationChangeSubscriberClient,
    private readonly channel = defaultChannel,
  ) {}

  static create(redisUrl: string): RedisJobApplicationChangeBus {
    return new RedisJobApplicationChangeBus(new Redis(redisUrl), new Redis(redisUrl));
  }

  async publish(change: JobApplicationChange): Promise<void> {
    await this.publisher.publish(this.channel, JSON.stringify(change));
  }

  async subscribe(profileId: string, listener: JobApplicationChangeListener): Promise<() => void> {
    if (!this.subscribed) {
      this.subscriber.on("message", this.handleMessage);
      await this.subscriber.subscribe(this.channel);
      this.subscribed = true;
    }

    const listeners = this.listeners.get(profileId) ?? new Set<JobApplicationChangeListener>();
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

    const change = parseJobApplicationChange(message);

    if (!change) {
      return;
    }

    for (const listener of this.listeners.get(change.profileId) ?? []) {
      listener(change);
    }
  };
}

function parseJobApplicationChange(message: string): JobApplicationChange | null {
  try {
    const change = JSON.parse(message) as Partial<JobApplicationChange>;

    if (
      (change.type === "application.changed" || change.type === "application.deleted") &&
      typeof change.applicationId === "string" &&
      typeof change.profileId === "string" &&
      typeof change.occurredAt === "string"
    ) {
      return change as JobApplicationChange;
    }
  } catch {
    return null;
  }

  return null;
}
