import { describe, expect, it } from "vitest";
import { z } from "zod";
import { normalizeObjectStorageEnv, objectStorageEnvShape } from "./object-storage-env.js";
import { validateProductionObjectStorageEnv } from "./production-secrets.js";

const schema = z.preprocess(normalizeObjectStorageEnv, z.object(objectStorageEnvShape));
const runtimeSchema = z.preprocess(
  normalizeObjectStorageEnv,
  z
    .object({
      NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
      ...objectStorageEnvShape,
    })
    .superRefine(validateProductionObjectStorageEnv),
);

describe("object storage environment", () => {
  it("defaults to local RustFS", () => {
    expect(schema.parse({})).toEqual({
      OBJECT_STORAGE_ACCESS_KEY_ID: "rustfsadmin",
      OBJECT_STORAGE_BUCKET: "careerden",
      OBJECT_STORAGE_ENDPOINT: "http://localhost:9000",
      OBJECT_STORAGE_FORCE_PATH_STYLE: true,
      OBJECT_STORAGE_REGION: "us-east-1",
      OBJECT_STORAGE_SECRET_ACCESS_KEY: "rustfsadmin",
    });
  });

  it("parses Cloudflare R2 configuration without path-style addressing", () => {
    expect(
      schema.parse({
        OBJECT_STORAGE_ACCESS_KEY_ID: "r2-access-key",
        OBJECT_STORAGE_BUCKET: "careerden-production",
        OBJECT_STORAGE_ENDPOINT: "https://account-id.r2.cloudflarestorage.com",
        OBJECT_STORAGE_FORCE_PATH_STYLE: "false",
        OBJECT_STORAGE_REGION: "auto",
        OBJECT_STORAGE_SECRET_ACCESS_KEY: "r2-secret-key",
      }),
    ).toEqual({
      OBJECT_STORAGE_ACCESS_KEY_ID: "r2-access-key",
      OBJECT_STORAGE_BUCKET: "careerden-production",
      OBJECT_STORAGE_ENDPOINT: "https://account-id.r2.cloudflarestorage.com",
      OBJECT_STORAGE_FORCE_PATH_STYLE: false,
      OBJECT_STORAGE_REGION: "auto",
      OBJECT_STORAGE_SECRET_ACCESS_KEY: "r2-secret-key",
    });
  });

  it("accepts legacy RustFS variables when current variables are absent", () => {
    expect(
      schema.parse({
        RUSTFS_ENDPOINT: "http://rustfs.internal:9000",
        RUSTFS_BUCKET: "legacy-bucket",
        RUSTFS_ACCESS_KEY_ID: "legacy-access-key",
        RUSTFS_SECRET_ACCESS_KEY: "legacy-secret-key",
        RUSTFS_REGION: "us-west-1",
        RUSTFS_FORCE_PATH_STYLE: "false",
      }),
    ).toEqual({
      OBJECT_STORAGE_ACCESS_KEY_ID: "legacy-access-key",
      OBJECT_STORAGE_BUCKET: "legacy-bucket",
      OBJECT_STORAGE_ENDPOINT: "http://rustfs.internal:9000",
      OBJECT_STORAGE_FORCE_PATH_STYLE: false,
      OBJECT_STORAGE_REGION: "us-west-1",
      OBJECT_STORAGE_SECRET_ACCESS_KEY: "legacy-secret-key",
    });
  });

  it("prefers current variables over legacy RustFS variables", () => {
    const result = schema.parse({
      OBJECT_STORAGE_BUCKET: "current-bucket",
      RUSTFS_BUCKET: "legacy-bucket",
    });

    expect(result.OBJECT_STORAGE_BUCKET).toBe("current-bucket");
  });

  it("rejects local defaults in production", () => {
    const result = runtimeSchema.safeParse({ NODE_ENV: "production" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual(
        expect.arrayContaining([
          "OBJECT_STORAGE_ACCESS_KEY_ID",
          "OBJECT_STORAGE_ENDPOINT",
          "OBJECT_STORAGE_SECRET_ACCESS_KEY",
        ]),
      );
    }
  });

  it("rejects a local production endpoint even with strong credentials", () => {
    const result = runtimeSchema.safeParse({
      NODE_ENV: "production",
      OBJECT_STORAGE_ACCESS_KEY_ID: "production-access-key",
      OBJECT_STORAGE_ENDPOINT: "http://127.0.0.2:9000",
      OBJECT_STORAGE_SECRET_ACCESS_KEY: "JmW9mVfbx5XKcYd7vP2kQ8nL4rT6sH3z",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: ["OBJECT_STORAGE_ENDPOINT"] })]),
      );
    }
  });

  it("rejects a production object-storage secret shorter than 32 bytes", () => {
    const result = runtimeSchema.safeParse({
      NODE_ENV: "production",
      OBJECT_STORAGE_ACCESS_KEY_ID: "production-access-key",
      OBJECT_STORAGE_ENDPOINT: "https://account-id.r2.cloudflarestorage.com",
      OBJECT_STORAGE_SECRET_ACCESS_KEY: "short-production-secret",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ["OBJECT_STORAGE_SECRET_ACCESS_KEY"] }),
        ]),
      );
    }
  });

  it("accepts explicit non-local production storage with a long secret", () => {
    expect(
      runtimeSchema.parse({
        NODE_ENV: "production",
        OBJECT_STORAGE_ACCESS_KEY_ID: "production-access-key",
        OBJECT_STORAGE_ENDPOINT: "https://account-id.r2.cloudflarestorage.com",
        OBJECT_STORAGE_FORCE_PATH_STYLE: "false",
        OBJECT_STORAGE_SECRET_ACCESS_KEY: "JmW9mVfbx5XKcYd7vP2kQ8nL4rT6sH3z",
      }),
    ).toMatchObject({
      NODE_ENV: "production",
      OBJECT_STORAGE_ACCESS_KEY_ID: "production-access-key",
      OBJECT_STORAGE_ENDPOINT: "https://account-id.r2.cloudflarestorage.com",
      OBJECT_STORAGE_FORCE_PATH_STYLE: false,
      OBJECT_STORAGE_SECRET_ACCESS_KEY: "JmW9mVfbx5XKcYd7vP2kQ8nL4rT6sH3z",
    });
  });
});
