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

describe("notificationsWorkerEnvSchema production email", () => {
  const validProductionStorage = {
    DATABASE_URL: "postgres://careerden:secret@database.internal:5432/careerden",
    NODE_ENV: "production",
    OBJECT_STORAGE_ACCESS_KEY_ID: "production-access-key",
    OBJECT_STORAGE_ENDPOINT: "https://account-id.r2.cloudflarestorage.com",
    OBJECT_STORAGE_FORCE_PATH_STYLE: "false",
    OBJECT_STORAGE_SECRET_ACCESS_KEY: "JmW9mVfbx5XKcYd7vP2kQ8nL4rT6sH3z",
  } as const;

  it("allows Resend configuration to be omitted when reminder email is disabled", () => {
    expect(notificationsWorkerEnvSchema.parse(validProductionStorage)).toMatchObject({
      NOTIFICATION_EMAIL_ENABLED: false,
      RESEND_API_KEY: "",
    });
  });

  it("requires Resend configuration when production reminder email is enabled", () => {
    const result = notificationsWorkerEnvSchema.safeParse({
      ...validProductionStorage,
      NOTIFICATION_EMAIL_ENABLED: "true",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ["EMAIL_FROM"] }),
          expect.objectContaining({ path: ["RESEND_API_KEY"] }),
        ]),
      );
    }
  });

  it("accepts configured production reminder email", () => {
    expect(
      notificationsWorkerEnvSchema.parse({
        ...validProductionStorage,
        EMAIL_FROM: "Careerden <no-reply@email.careerden.com>",
        NOTIFICATION_EMAIL_ENABLED: "true",
        RESEND_API_KEY: "re_production",
      }),
    ).toMatchObject({
      EMAIL_FROM: "Careerden <no-reply@email.careerden.com>",
      NOTIFICATION_EMAIL_ENABLED: true,
      RESEND_API_KEY: "re_production",
    });
  });
});
