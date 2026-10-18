import { Buffer } from "node:buffer";
import process from "node:process";

import { createOpencodeClient } from "@opencode-ai/sdk/v2";
import { z } from "zod";

import { OpencodeAiProvider } from "../dist/index.js";

const config = {
  baseUrl: process.env.OPENCODE_BASE_URL ?? "http://localhost:4096",
  username: process.env.OPENCODE_SERVER_USERNAME ?? "opencode",
  password: process.env.OPENCODE_SERVER_PASSWORD ?? "dev-only-careerden-opencode-password",
  model: process.env.OPENCODE_FREE_MODEL ?? "space-bunny-free",
  timeoutMs: Number(process.env.OPENCODE_TIMEOUT_MS ?? 120_000),
};
const client = createOpencodeClient({
  baseUrl: config.baseUrl,
  headers: {
    Authorization: `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`,
  },
  throwOnError: true,
});

const startedAt = Date.now();
const output = await new OpencodeAiProvider(config, client).generate({
  tier: "free",
  system: "You extract job requirements. Use only what the description states.",
  prompt: JSON.stringify({
    description: "We need a backend engineer with TypeScript, PostgreSQL and Redis experience.",
  }),
  outputSchema: z.object({ requirements: z.array(z.string()).min(1) }),
});

const { data: sessions } = await client.session.list();
if (sessions.length > 0) {
  throw new Error(`OpenCode smoke test left ${sessions.length} session(s) on the server`);
}

process.stdout.write(
  `OpenCode smoke test passed in ${Date.now() - startedAt} ms with ${config.model}: ${JSON.stringify(output)}\n`,
);
