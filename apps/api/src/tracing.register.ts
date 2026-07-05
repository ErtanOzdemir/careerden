import { register } from "node:module";
import { createAddHookMessageChannel } from "import-in-the-middle";

const { registerOptions, waitForAllMessagesAcknowledged } = createAddHookMessageChannel();
register("import-in-the-middle/hook.mjs", import.meta.url, registerOptions);
await waitForAllMessagesAcknowledged();

const { loadApiEnv } = await import("./env.js");
const { setupTracing } = await import("./tracing.js");
const env = loadApiEnv();
setupTracing(env);
