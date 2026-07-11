import { Worker } from "bullmq";
import type { Worker as BullMqWorker } from "bullmq";
import {
  AnalyzeScrapedJobUseCase,
  JobApplicationChangeNotifier,
  RunMatchAnalysisUseCase,
} from "@link2cv/application";
import type { JobApplicationQueuePayload } from "@link2cv/domain";
import {
  AiProviderFactory,
  BullMqJobApplicationQueue,
  PostgresAnalysisOutboxDispatcher,
  PostgresJobApplicationRepository,
  PostgresJobApplicationChangeOutboxDispatcher,
  PostgresOutboxRepository,
  PostgresUserProfileRepository,
  RedisJobApplicationChangeBus,
  createPostgresDb,
  jobApplicationQueueName,
} from "@link2cv/infrastructure";
import type { Knex } from "knex";
import type { LlmWorkerEnv } from "./env.js";
import { toBullMqWorkerError } from "./bullmq-worker-error.js";

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
  const outboxDispatcher = new PostgresJobApplicationChangeOutboxDispatcher(
    new PostgresOutboxRepository(db),
    changeBus,
  );
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
      await Promise.all([
        outboxDispatcher.dispatchPending(),
        analysisOutboxDispatcher.dispatchPending(),
      ]);
    } finally {
      isDispatchingOutbox = false;
    }
  };
  await dispatchOutbox();
  const outboxInterval = setInterval(() => {
    void dispatchOutbox().catch((error) => {
      console.error("LLM worker failed job application change outbox dispatch", error);
    });
  }, 1_000);
  const aiProviderFactory = new AiProviderFactory({
    aiProvider: env.AI_PROVIDER,
    openaiApiKey: env.OPENAI_API_KEY,
    geminiApiKey: env.GEMINI_API_KEY,
    deepseekApiKey: env.DEEPSEEK_API_KEY,
  });
  const analyzeScrapedJob = new AnalyzeScrapedJobUseCase(
    jobApplications,
    profiles,
    new RunMatchAnalysisUseCase(aiProviderFactory.create(), jobApplications),
    new JobApplicationChangeNotifier(changeBus),
  );
  const worker = new Worker<JobApplicationQueuePayload>(
    jobApplicationQueueName,
    async (job) => {
      try {
        return await analyzeScrapedJob.execute(job.data);
      } catch (error) {
        throw toBullMqWorkerError(error);
      }
    },
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
      await worker.close();
      await analysisQueue.close();
      await changeBus.close();
      await db.destroy();
    },
  };
}
