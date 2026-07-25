import { describe, expect, it } from "vitest";
import { notificationsWorkerEnvSchema } from "./env.js";

describe("notificationsWorkerEnvSchema production storage", () => {
  it("rejects development object-storage defaults in production", () => {
    expect(
      notificationsWorkerEnvSchema.safeParse({
        DATABASE_URL: "postgres://careerden:secret@database.internal:5432/careerden",
        NODE_ENV: "production",
      }).success,
    ).toBe(false);
  });
});

describe("notificationsWorkerEnvSchema health port", () => {
  it("provides a dedicated default and accepts a configured port", () => {
    expect(
      notificationsWorkerEnvSchema.parse({
        DATABASE_URL: "postgres://localhost/careerden",
      }).NOTIFICATIONS_WORKER_HEALTH_PORT,
    ).toBe(3103);
    expect(
      notificationsWorkerEnvSchema.parse({
        DATABASE_URL: "postgres://localhost/careerden",
        NOTIFICATIONS_WORKER_HEALTH_PORT: "4103",
      }).NOTIFICATIONS_WORKER_HEALTH_PORT,
    ).toBe(4103);
  });
});
