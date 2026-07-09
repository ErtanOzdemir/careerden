import { createNotificationsWorkerRuntime } from "./app.js";
import { loadNotificationsWorkerEnv } from "./env.js";

const env = loadNotificationsWorkerEnv();
const runtime = await createNotificationsWorkerRuntime(env);

console.log(
  `Link2CV notifications worker listening on queue "follow-up-reminders" with concurrency ${env.NOTIFICATIONS_WORKER_CONCURRENCY}`,
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
