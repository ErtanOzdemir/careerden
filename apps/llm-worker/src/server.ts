import { createLlmWorkerRuntime } from "./app.js";
import { loadLlmWorkerEnv } from "./env.js";

const env = loadLlmWorkerEnv();
const runtime = await createLlmWorkerRuntime(env);

console.log(
  `Link2CV LLM worker listening on queue "job-applications" with concurrency ${env.LLM_WORKER_CONCURRENCY}`,
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
