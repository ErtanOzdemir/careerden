import { describe, expect, it } from "vitest";
import { llmWorkerEnvSchema } from "./env.js";

describe("llmWorkerEnvSchema health port", () => {
  it("provides a dedicated default and accepts a configured port", () => {
    expect(
      llmWorkerEnvSchema.parse({
        DATABASE_URL: "postgres://localhost/careerden",
      }).LLM_WORKER_HEALTH_PORT,
    ).toBe(3101);
    expect(
      llmWorkerEnvSchema.parse({
        DATABASE_URL: "postgres://localhost/careerden",
        LLM_WORKER_HEALTH_PORT: "4101",
      }).LLM_WORKER_HEALTH_PORT,
    ).toBe(4101);
  });

  it("rejects ports outside the TCP range", () => {
    expect(
      llmWorkerEnvSchema.safeParse({
        DATABASE_URL: "postgres://localhost/careerden",
        LLM_WORKER_HEALTH_PORT: 65_536,
      }).success,
    ).toBe(false);
  });
});
