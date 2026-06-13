import cors from "cors";
import express from "express";
import type { Express } from "express";
import type { JobApplicationQueue } from "@link2cv/domain";
import { Pool } from "pg";
import {
  CreateProfileUseCase,
  SubmitJobApplicationUseCase
} from "@link2cv/application";
import {
  BullMqJobApplicationQueue,
  InMemoryJobApplicationQueue,
  InMemoryJobApplicationRepository,
  InMemoryUserProfileRepository,
  LinkedInSessionManager,
  LocalFileStorage,
  PostgresJobApplicationRepository,
  PostgresUserProfileRepository
} from "@link2cv/infrastructure";
import { createJobApplicationRouter } from "./routes/job-applications.routes.js";
import { createLinkedInSessionRouter } from "./routes/linkedin-session.routes.js";
import { createProfileRouter } from "./routes/profiles.routes.js";
import { errorHandler } from "./middleware/error-handler.js";
import { UnavailableJobApplicationQueue } from "./queues/unavailable-job-application.queue.js";

export interface ApiAppOptions {
  databaseUrl?: string;
  linkedInSessionSecret?: string;
  linkedInSessionStorageDir?: string;
  redisUrl?: string;
  storageDir?: string;
}

export function createApiApp(options: ApiAppOptions = {}): Express {
  const app = express();
  const pool = options.databaseUrl ? new Pool({ connectionString: options.databaseUrl }) : undefined;
  const profiles = pool
    ? new PostgresUserProfileRepository(pool)
    : new InMemoryUserProfileRepository();
  const jobApplications = pool
    ? new PostgresJobApplicationRepository(pool)
    : new InMemoryJobApplicationRepository();
  const queue = createQueue({
    redisUrl: options.redisUrl,
    requiresPersistentQueue: Boolean(pool)
  });
  const storage = new LocalFileStorage(options.storageDir ?? "./storage");
  const linkedInSessionManager = new LinkedInSessionManager(
    options.linkedInSessionStorageDir ?? "./storage/linkedin-session",
    options.linkedInSessionSecret ?? "dev-only-linkedin-session-secret"
  );

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.use(
    "/profiles",
    createProfileRouter({
      createProfile: new CreateProfileUseCase(profiles),
      profiles
    })
  );

  app.use(
    "/job-applications",
    createJobApplicationRouter({
      submitJobApplication: new SubmitJobApplicationUseCase(jobApplications, profiles, queue),
      jobApplications,
      storage
    })
  );

  app.use(
    "/linkedin-session",
    createLinkedInSessionRouter({
      linkedInSessionManager
    })
  );

  app.use(errorHandler);

  return app;
}

function createQueue(input: {
  redisUrl?: string;
  requiresPersistentQueue: boolean;
}): JobApplicationQueue {
  if (!input.redisUrl && input.requiresPersistentQueue) {
    return new UnavailableJobApplicationQueue(
      "REDIS_URL is required to enqueue job processing when using PostgreSQL. Start Redis and set REDIS_URL=redis://localhost:6379."
    );
  }

  if (!input.redisUrl) {
    return new InMemoryJobApplicationQueue();
  }

  const redisUrl = new URL(input.redisUrl);

  return new BullMqJobApplicationQueue({
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379)
  });
}
