import { Worker } from "bullmq";
import type { Worker as BullMqWorker } from "bullmq";
import { AnalyzeScrapedJobUseCase, RunMatchAnalysisUseCase } from "@link2cv/application";
import type { JobApplicationQueuePayload } from "@link2cv/domain";
import {
  AiProviderFactory,
  PostgresJobApplicationRepository,
  PostgresUserProfileRepository,
  PublishingJobApplicationRepository,
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
  const innerJobApplications = new PostgresJobApplicationRepository(db);
  const jobApplications = new PublishingJobApplicationRepository(innerJobApplications, changeBus);
  const profiles = new PostgresUserProfileRepository(db);
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
      await worker.close();
      await changeBus.close();
      await db.destroy();
    },
  };
}
