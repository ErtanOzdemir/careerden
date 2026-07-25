import { startBullMqWorkerHealthServer } from "@careerden/infrastructure";
import { createDocumentsWorkerRuntime } from "./app.js";
import { loadDocumentsWorkerEnv } from "./env.js";

const env = loadDocumentsWorkerEnv();
const runtime = await createDocumentsWorkerRuntime(env);
const healthServer = await startBullMqWorkerHealthServer({
  database: runtime.db,
  port: env.DOCUMENTS_WORKER_HEALTH_PORT,
  worker: runtime.worker,
}).catch(async (error: unknown) => {
  await runtime.close();
  throw error;
});

console.log(
  `Careerden documents worker listening on queue "application-pack-generations" with concurrency ${env.DOCUMENTS_WORKER_CONCURRENCY}; health server listening on 127.0.0.1:${healthServer.port}`,
);

let shutdownPromise: Promise<void> | undefined;

async function shutdown() {
  shutdownPromise ??= Promise.all([healthServer.close(), runtime.close()]).then(() => undefined);
  await shutdownPromise;
}

process.on("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});
process.on("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});
