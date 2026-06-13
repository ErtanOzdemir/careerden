import type {
  JobApplicationQueue,
  JobApplicationRepository,
  UserProfileRepository,
} from "@link2cv/domain";
import { Pool } from "pg";
import { InMemoryJobApplicationRepository } from "./db/in-memory-job-application.repository.js";
import { InMemoryUserProfileRepository } from "./db/in-memory-user-profile.repository.js";
import { PostgresJobApplicationRepository } from "./db/postgres-job-application.repository.js";
import { PostgresUserProfileRepository } from "./db/postgres-user-profile.repository.js";
import { BullMqJobApplicationQueue } from "./queues/bullmq-job-application.queue.js";
import { InMemoryJobApplicationQueue } from "./queues/in-memory-job-application.queue.js";
import { UnavailableJobApplicationQueue } from "./queues/unavailable-job-application.queue.js";

export function createRepositories(config: {
  databaseUrl?: string;
}): {
  profiles: UserProfileRepository;
  jobApplications: JobApplicationRepository;
} {
  const pool = config.databaseUrl
    ? new Pool({ connectionString: config.databaseUrl })
    : undefined;

  return {
    profiles: pool
      ? new PostgresUserProfileRepository(pool)
      : new InMemoryUserProfileRepository(),
    jobApplications: pool
      ? new PostgresJobApplicationRepository(pool)
      : new InMemoryJobApplicationRepository(),
  };
}

export function createQueue(config: {
  redisUrl?: string;
  requiresPersistentQueue: boolean;
}): JobApplicationQueue {
  if (!config.redisUrl && config.requiresPersistentQueue) {
    return new UnavailableJobApplicationQueue(
      "REDIS_URL is required to enqueue job processing when using PostgreSQL. Start Redis and set REDIS_URL=redis://localhost:6379.",
    );
  }

  if (!config.redisUrl) {
    return new InMemoryJobApplicationQueue();
  }

  const redisUrl = new URL(config.redisUrl);

  return new BullMqJobApplicationQueue({
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379),
  });
}
