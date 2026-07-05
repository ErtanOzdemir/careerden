import { loadApiEnv } from "./env.js";

const env = loadApiEnv();
const { createApiRuntime } = await import("./app.js");
const runtime = await createApiRuntime(env);

const server = runtime.app.listen(env.PORT);

async function shutdown() {
  server.close();
  await runtime.close();
}

process.on("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});
process.on("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});
