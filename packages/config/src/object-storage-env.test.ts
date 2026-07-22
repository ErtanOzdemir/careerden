import { describe, expect, it } from "vitest";
import { z } from "zod";
import { normalizeObjectStorageEnv, objectStorageEnvShape } from "./object-storage-env.js";

const schema = z.preprocess(normalizeObjectStorageEnv, z.object(objectStorageEnvShape));

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
});
