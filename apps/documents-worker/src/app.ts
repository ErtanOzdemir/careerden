import { Worker } from "bullmq";
import type { Worker as BullMqWorker } from "bullmq";
import { FailApplicationPackGenerationUseCase } from "./application/job-applications/fail-application-pack-generation.use-case.js";
import { GenerateDocumentsUseCase } from "@careerden/application";
import { GenerateRequestedApplicationPackUseCase } from "./application/job-applications/generate-requested-application-pack.use-case.js";
import type { ApplicationPackGenerationQueuePayload } from "./domain/job-applications/application-pack-generation.queue.js";
import {
  BullMqApplicationPackGenerationQueue,
  applicationPackGenerationQueueName,
} from "./infrastructure/queue/job-applications/bullmq-application-pack-generation.queue.js";
import {
  HtmlTemplateRenderer,
  PlaywrightPdfRenderer,
  PostgresJobApplicationRepository,
  PostgresOutboxRepository,
  PostgresPersistenceUnitOfWork,
  PostgresStorageOutboxDispatcher,
  PostgresUserProfileRepository,
  RedisJobApplicationChangeBus,
  S3CompatibleStorage,
  createPostgresDb,
} from "@careerden/infrastructure";
import { PostgresApplicationPackGenerationOutboxDispatcher } from "./infrastructure/persistence/postgres-application-pack-generation-outbox.dispatcher.js";
import type { Knex } from "knex";
import type { DocumentsWorkerEnv } from "./env.js";
import { processApplicationPackGeneration } from "./process-application-pack-generation.js";

export interface DocumentsWorkerRuntime {
  db: Knex;
  worker: BullMqWorker<ApplicationPackGenerationQueuePayload>;
  close: () => Promise<void>;
}

export async function createDocumentsWorkerRuntime(
  env: DocumentsWorkerEnv,
): Promise<DocumentsWorkerRuntime> {
  const db = createPostgresDb(env.DATABASE_URL);
  const changeBus = RedisJobApplicationChangeBus.create(env.REDIS_URL);
  const jobApplications = new PostgresJobApplicationRepository(db);
  const profiles = new PostgresUserProfileRepository(db);
  const unitOfWork = new PostgresPersistenceUnitOfWork(db, changeBus);
  const storage = new S3CompatibleStorage({
    accessKeyId: env.OBJECT_STORAGE_ACCESS_KEY_ID,
    bucket: env.OBJECT_STORAGE_BUCKET,
    endpoint: env.OBJECT_STORAGE_ENDPOINT,
    forcePathStyle: env.OBJECT_STORAGE_FORCE_PATH_STYLE,
    region: env.OBJECT_STORAGE_REGION,
    secretAccessKey: env.OBJECT_STORAGE_SECRET_ACCESS_KEY,
  });
  const generationQueue = BullMqApplicationPackGenerationQueue.create(env.REDIS_URL);
  const generationOutbox = new PostgresApplicationPackGenerationOutboxDispatcher(
    new PostgresOutboxRepository(db),
    generationQueue,
  );
  const storageOutbox = new PostgresStorageOutboxDispatcher(
    new PostgresOutboxRepository(db),
    storage,
  );
  const generate = new GenerateRequestedApplicationPackUseCase(
    jobApplications,
    profiles,
    new GenerateDocumentsUseCase(
      new HtmlTemplateRenderer(),
      new PlaywrightPdfRenderer(),
      storage,
      jobApplications,
      profiles,
    ),
    unitOfWork,
  );
  const fail = new FailApplicationPackGenerationUseCase(unitOfWork);

  let isDispatchingOutbox = false;
  const dispatchOutbox = async () => {
    if (isDispatchingOutbox) return;
    isDispatchingOutbox = true;
    try {
      await Promise.all([generationOutbox.dispatchPending(), storageOutbox.dispatchPending()]);
    } finally {
      isDispatchingOutbox = false;
    }
  };
  await dispatchOutbox();
  const outboxInterval = setInterval(() => {
    void dispatchOutbox().catch((error) => {
      console.error("Documents worker failed outbox dispatch", error);
    });
  }, 1_000);

  const worker = new Worker<ApplicationPackGenerationQueuePayload>(
    applicationPackGenerationQueueName,
    (job) =>
      processApplicationPackGeneration({
        payload: job.data,
        attemptsMade: job.attemptsMade,
        maximumAttempts: job.opts.attempts ?? 1,
        generate,
        fail,
      }),
    {
      concurrency: env.DOCUMENTS_WORKER_CONCURRENCY,
      connection: { url: env.REDIS_URL },
    },
  );

  worker.on("failed", (job, error) => {
    console.error(
      `Documents worker failed job ${job?.id ?? "unknown"} for application ${
        job?.data.jobApplicationId ?? "unknown"
      }`,
      error,
    );
  });

  return {
    db,
    worker,
    close: async () => {
      clearInterval(outboxInterval);
      await worker.close();
      await generationQueue.close();
      await changeBus.close();
      await db.destroy();
    },
  };
}
