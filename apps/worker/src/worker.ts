import { Worker } from "bullmq";
import { loadEnv } from "@link2cv/config";
import {
  BullMqJobApplicationQueue,
  jobApplicationProcessingQueueName,
} from "@link2cv/infrastructure";
import { createWorkerDependencies } from "./composition-root.js";

const env = loadEnv();
if (!env.REDIS_URL) {
  throw new Error("REDIS_URL is required to start the worker");
}

const { processor, connection, jobApplications } = createWorkerDependencies(env);

await requeueQueuedJobApplications();

new Worker(
  jobApplicationProcessingQueueName,
  async (job) => {
    await processor.execute(job.data.jobApplicationId);
  },
  { connection },
);

console.log(`Link2CV worker listening on queue ${jobApplicationProcessingQueueName}`);

async function requeueQueuedJobApplications(): Promise<void> {
  const queue = new BullMqJobApplicationQueue(connection);
  const queued = await jobApplications.listByStatus("queued");

  for (const jobApplication of queued) {
    await queue.enqueue({ jobApplicationId: jobApplication.id });
  }

  if (queued.length > 0) {
    console.log(`Requeued ${queued.length} queued job application(s)`);
  }
}
