import { describe, expect, it } from "vitest";
import { apiEnvSchema } from "./env.js";

const validProductionEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "postgres://careerden:secret@database.internal:5432/careerden",
  BETTER_AUTH_SECRET: "N6wK2pV9sX4qR8mT7hY3cF5jL1zD0bGa",
  CREEM_API_KEY: "creem_production_key",
  CREEM_WEBHOOK_SECRET: "creem-production-webhook-secret",
  CREEM_PRODUCT_ID: "prod_production",
  CREEM_TEST_MODE: "false",
  EMAIL_FROM: "Careerden <no-reply@email.careerden.com>",
  OBJECT_STORAGE_ACCESS_KEY_ID: "production-access-key",
  OBJECT_STORAGE_ENDPOINT: "https://account-id.r2.cloudflarestorage.com",
  OBJECT_STORAGE_FORCE_PATH_STYLE: "false",
  OBJECT_STORAGE_SECRET_ACCESS_KEY: "JmW9mVfbx5XKcYd7vP2kQ8nL4rT6sH3z",
  OPEN_OBSERVE_KEY: "observability-key",
  RESEND_API_KEY: "re_production",
} as const;

describe("apiEnvSchema production secrets", () => {
  it("keeps development defaults available for local startup", () => {
    expect(
      apiEnvSchema.parse({
        DATABASE_URL: "postgres://careerden:careerden@localhost:5432/careerden",
        OPEN_OBSERVE_KEY: "local-key",
      }),
    ).toMatchObject({
      BETTER_AUTH_SECRET: "dev-only-careerden-better-auth-secret",
      NODE_ENV: "development",
      CREEM_TEST_MODE: true,
      OBJECT_STORAGE_ENDPOINT: "http://localhost:9000",
    });
  });

  it("rejects the known Better Auth default in production", () => {
    const result = apiEnvSchema.safeParse({
      ...validProductionEnv,
      BETTER_AUTH_SECRET: "dev-only-careerden-better-auth-secret",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: ["BETTER_AUTH_SECRET"] })]),
      );
    }
  });

  it("rejects a short Better Auth secret in production", () => {
    const result = apiEnvSchema.safeParse({
      ...validProductionEnv,
      BETTER_AUTH_SECRET: "short-production-secret",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: ["BETTER_AUTH_SECRET"] })]),
      );
    }
  });

  it("accepts explicit production auth and object-storage secrets", () => {
    expect(apiEnvSchema.parse(validProductionEnv)).toMatchObject({
      BETTER_AUTH_SECRET: validProductionEnv.BETTER_AUTH_SECRET,
      NODE_ENV: "production",
      OBJECT_STORAGE_ACCESS_KEY_ID: validProductionEnv.OBJECT_STORAGE_ACCESS_KEY_ID,
      OBJECT_STORAGE_ENDPOINT: validProductionEnv.OBJECT_STORAGE_ENDPOINT,
      OBJECT_STORAGE_SECRET_ACCESS_KEY: validProductionEnv.OBJECT_STORAGE_SECRET_ACCESS_KEY,
    });
  });

  it("rejects missing Resend configuration in production", () => {
    const result = apiEnvSchema.safeParse({
      ...validProductionEnv,
      EMAIL_FROM: "Careerden <no-reply@careerden.local>",
      RESEND_API_KEY: "",
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

  it("rejects a partially configured Creem integration", () => {
    const result = apiEnvSchema.safeParse({
      DATABASE_URL: "postgres://careerden:careerden@localhost:5432/careerden",
      OPEN_OBSERVE_KEY: "local-key",
      CREEM_API_KEY: "creem_test_key",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ["CREEM_WEBHOOK_SECRET"] }),
          expect.objectContaining({ path: ["CREEM_PRODUCT_ID"] }),
        ]),
      );
    }
  });
});
