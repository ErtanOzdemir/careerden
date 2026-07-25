import { describe, expect, it } from "vitest";
import { documentsWorkerEnvSchema } from "./env.js";

describe("documentsWorkerEnvSchema production storage", () => {
  it("rejects development object-storage defaults in production", () => {
    expect(
      documentsWorkerEnvSchema.safeParse({
        DATABASE_URL: "postgres://careerden:secret@database.internal:5432/careerden",
        NODE_ENV: "production",
      }).success,
    ).toBe(false);
  });
});

describe("documentsWorkerEnvSchema health port", () => {
  it("provides a dedicated default and accepts a configured port", () => {
    expect(
      documentsWorkerEnvSchema.parse({
        DATABASE_URL: "postgres://localhost/careerden",
      }).DOCUMENTS_WORKER_HEALTH_PORT,
    ).toBe(3102);
    expect(
      documentsWorkerEnvSchema.parse({
        DATABASE_URL: "postgres://localhost/careerden",
        DOCUMENTS_WORKER_HEALTH_PORT: "4102",
      }).DOCUMENTS_WORKER_HEALTH_PORT,
    ).toBe(4102);
  });
});
