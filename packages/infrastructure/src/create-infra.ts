import type {
  JobApplicationQueue,
  JobApplicationRepository,
  UserProfileRepository,
} from "@link2cv/domain";
import { createDb } from "./persistence/knex.js";
import { InMemoryJobApplicationRepository } from "./persistence/job-applications/in-memory-job-application.repository.js";
import { PostgresJobApplicationRepository } from "./persistence/job-applications/postgres-job-application.repository.js";
import { InMemoryUserProfileRepository } from "./persistence/profiles/in-memory-user-profile.repository.js";
import { PostgresUserProfileRepository } from "./persistence/profiles/postgres-user-profile.repository.js";
import { BullMqJobApplicationQueue } from "./queue/job-applications/bullmq-job-application.queue.js";
import { InMemoryJobApplicationQueue } from "./queue/job-applications/in-memory-job-application.queue.js";
import { UnavailableJobApplicationQueue } from "./queue/job-applications/unavailable-job-application.queue.js";

export function createRepositories(config: {
  databaseUrl?: string;
}): {
  profiles: UserProfileRepository;
  jobApplications: JobApplicationRepository;
} {
  const db = config.databaseUrl
    ? createDb(config.databaseUrl)
    : undefined;

  return {
    profiles: db
      ? new PostgresUserProfileRepository(db)
      : new InMemoryUserProfileRepository(),
    jobApplications: db
      ? new PostgresJobApplicationRepository(db)
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
