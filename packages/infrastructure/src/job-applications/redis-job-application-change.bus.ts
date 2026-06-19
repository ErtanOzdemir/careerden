import { Redis } from "ioredis";
import type {
  JobApplicationChange,
  JobApplicationChangeListener,
  JobApplicationChangePublisher,
  JobApplicationChangeSubscriber,
} from "@link2cv/domain";

const channelPrefix = "link2cv:job-applications:profile:";

export class RedisJobApplicationChangePublisher implements JobApplicationChangePublisher {
  private readonly redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      connectTimeout: 2_000,
      maxRetriesPerRequest: 1,
    });
  }

  async publish(change: JobApplicationChange): Promise<void> {
    await this.redis.publish(channel(change.profileId), JSON.stringify(change));
  }
}

export class RedisJobApplicationChangeSubscriber implements JobApplicationChangeSubscriber {
  private readonly redis: Redis;
  private readonly listeners = new Map<string, Set<JobApplicationChangeListener>>();

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
    this.redis.on("message", (receivedChannel: string, message: string) => {
      const change = parseChange(message);

      if (!change) {
        return;
      }

      for (const listener of this.listeners.get(receivedChannel) ?? []) {
        listener(change);
      }
    });
  }

  async subscribe(profileId: string, listener: JobApplicationChangeListener): Promise<() => void> {
    const profileChannel = channel(profileId);
    let listeners = this.listeners.get(profileChannel);

    if (!listeners) {
      listeners = new Set();
      this.listeners.set(profileChannel, listeners);
      await this.redis.subscribe(profileChannel);
    }

    listeners.add(listener);

    return () => {
      void this.unsubscribe(profileChannel, listener).catch(() => undefined);
    };
  }

  private async unsubscribe(
    profileChannel: string,
    listener: JobApplicationChangeListener,
  ): Promise<void> {
    const listeners = this.listeners.get(profileChannel);
    listeners?.delete(listener);

    if (listeners && listeners.size === 0) {
      this.listeners.delete(profileChannel);
      await this.redis.unsubscribe(profileChannel);
    }
  }
}

function channel(profileId: string): string {
  return `${channelPrefix}${profileId}`;
}

function parseChange(message: string): JobApplicationChange | null {
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
