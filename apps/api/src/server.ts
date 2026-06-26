import { loadApiEnv } from "./env.js";
import { createApiRuntime } from "./app.js";

const env = loadApiEnv();
const runtime = await createApiRuntime(env);

const server = runtime.app.listen(env.PORT, () => {
  console.log(`Link2CV API listening on http://localhost:${env.PORT}`);
});

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
