import { Worker } from "bullmq";
import type { Worker as BullMqWorker } from "bullmq";
import {
  FailApplicationPackGenerationUseCase,
  GenerateDocumentsUseCase,
  GenerateRequestedApplicationPackUseCase,
} from "@link2cv/application";
import type { ApplicationPackGenerationQueuePayload } from "@link2cv/domain";
import {
  BullMqApplicationPackGenerationQueue,
  DocxtemplaterTemplateRenderer,
  GotenbergDocxPdfRenderer,
  HtmlTemplateRenderer,
  PlaywrightPdfRenderer,
  PostgresApplicationPackGenerationOutboxDispatcher,
  PostgresJobApplicationRepository,
  PostgresOutboxRepository,
  PostgresPersistenceUnitOfWork,
  PostgresStorageOutboxDispatcher,
  PostgresUserProfileRepository,
  RedisJobApplicationChangeBus,
  RustFsStorage,
  applicationPackGenerationQueueName,
  createPostgresDb,
} from "@link2cv/infrastructure";
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
  const storage = new RustFsStorage({
    accessKeyId: env.RUSTFS_ACCESS_KEY_ID,
    bucket: env.RUSTFS_BUCKET,
    endpoint: env.RUSTFS_ENDPOINT,
    forcePathStyle: env.RUSTFS_FORCE_PATH_STYLE,
    region: env.RUSTFS_REGION,
    secretAccessKey: env.RUSTFS_SECRET_ACCESS_KEY,
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
      new DocxtemplaterTemplateRenderer(),
      new GotenbergDocxPdfRenderer({ baseUrl: env.GOTENBERG_URL }),
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
