import { createDocumentsWorkerRuntime } from "./app.js";
import { loadDocumentsWorkerEnv } from "./env.js";

const env = loadDocumentsWorkerEnv();
const runtime = await createDocumentsWorkerRuntime(env);

console.log(
  `Careerden documents worker listening on queue "application-pack-generations" with concurrency ${env.DOCUMENTS_WORKER_CONCURRENCY}`,
);

async function shutdown() {
  await runtime.close();
}

process.on("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});
process.on("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});
