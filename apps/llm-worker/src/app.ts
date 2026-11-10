import {
  AnalyzeScrapedJobUseCase,
  ExpireStaleCreditReservationsUseCase,
  ExtractJobRequirementsUseCase,
  FinalizeJobApplicationAnalysisFailureUseCase,
} from "@careerden/application";
import { Worker } from "bullmq";
import type { Worker as BullMqWorker } from "bullmq";
import { RunMatchAnalysisUseCase } from "@careerden/application";
import type { JobApplicationQueuePayload } from "@careerden/domain";
import {
  AiProviderFactory,
  PostgresJobApplicationRepository,
  PostgresOutboxRepository,
  PostgresPersistenceUnitOfWork,
  PostgresUserProfileRepository,
  RedisJobApplicationChangeBus,
  createPostgresDb,
} from "@careerden/infrastructure";
import {
  BullMqJobApplicationQueue,
  jobApplicationQueueName,
} from "./infrastructure/queue/job-applications/bullmq-job-application.queue.js";
import { PostgresAnalysisOutboxDispatcher } from "./infrastructure/persistence/postgres-analysis-outbox.dispatcher.js";
import type { Knex } from "knex";
import type { LlmWorkerEnv } from "./env.js";
import { processMatchAnalysis } from "./process-match-analysis.js";

export interface LlmWorkerRuntime {
  db: Knex;
  worker: BullMqWorker<JobApplicationQueuePayload>;
  close: () => Promise<void>;
}

export async function createLlmWorkerRuntime(env: LlmWorkerEnv): Promise<LlmWorkerRuntime> {
  const db = createPostgresDb(env.DATABASE_URL);
  const changeBus = RedisJobApplicationChangeBus.create(env.REDIS_URL);
  const jobApplications = new PostgresJobApplicationRepository(db);
  const profiles = new PostgresUserProfileRepository(db);
  const unitOfWork = new PostgresPersistenceUnitOfWork(db, changeBus);
  const analysisQueue = BullMqJobApplicationQueue.create(env.REDIS_URL);
  const analysisOutboxDispatcher = new PostgresAnalysisOutboxDispatcher(
    new PostgresOutboxRepository(db),
    analysisQueue,
  );
  let isDispatchingOutbox = false;
  const dispatchOutbox = async () => {
    if (isDispatchingOutbox) return;
    isDispatchingOutbox = true;
    try {
      await analysisOutboxDispatcher.dispatchPending();
    } finally {
      isDispatchingOutbox = false;
    }
  };
  await dispatchOutbox();
  const outboxInterval = setInterval(() => {
    void dispatchOutbox().catch((error) => {
      console.error("LLM worker failed analysis outbox dispatch", error);
    });
  }, 1_000);
  const aiProviderFactory = new AiProviderFactory({
    aiProvider: env.AI_PROVIDER,
    openaiApiKey: env.OPENAI_API_KEY,
    geminiApiKey: env.GEMINI_API_KEY,
    deepseekApiKey: env.DEEPSEEK_API_KEY,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    openrouterApiKey: env.OPENROUTER_API_KEY,
  });
  const aiProvider = aiProviderFactory.create();
  const analyzeScrapedJob = new AnalyzeScrapedJobUseCase(
    jobApplications,
    profiles,
    new RunMatchAnalysisUseCase(aiProvider),
    unitOfWork,
    new ExtractJobRequirementsUseCase(aiProvider),
  );
  const finalizeAnalysisFailure = new FinalizeJobApplicationAnalysisFailureUseCase(unitOfWork);
  const expireStaleReservations = new ExpireStaleCreditReservationsUseCase(unitOfWork);
  let isExpiringReservations = false;
  const expireReservations = async () => {
    if (isExpiringReservations) return;
    isExpiringReservations = true;
    try {
      await expireStaleReservations.execute();
    } finally {
      isExpiringReservations = false;
    }
  };
  await expireReservations();
  const reservationExpiryInterval = setInterval(() => {
    void expireReservations().catch((error) => {
      console.error("LLM worker failed stale credit reservation recovery", error);
    });
  }, 60_000);
  const worker = new Worker<JobApplicationQueuePayload>(
    jobApplicationQueueName,
    (job) =>
      processMatchAnalysis({
        payload: job.data,
        attemptsMade: job.attemptsMade,
        maximumAttempts: job.opts.attempts ?? 1,
        analyze: analyzeScrapedJob,
        finalizeFailure: finalizeAnalysisFailure,
      }),
    {
      concurrency: env.LLM_WORKER_CONCURRENCY,
      connection: { url: env.REDIS_URL },
    },
  );

  worker.on("failed", (job, error) => {
    console.error(
      `LLM worker failed job ${job?.id ?? "unknown"} for application ${
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
      clearInterval(reservationExpiryInterval);
      await worker.close();
      await analysisQueue.close();
      await changeBus.close();
      await db.destroy();
    },
  };
}
