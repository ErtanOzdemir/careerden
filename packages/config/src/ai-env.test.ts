import { describe, expect, it } from "vitest";
import { z } from "zod";
import { aiEnvShape, validateProductionAiEnv } from "./ai-env.js";

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    ...aiEnvShape,
  })
  .superRefine(validateProductionAiEnv);

const strongPassword = "JmW9mVfbx5XKcYd7vP2kQ8nL4rT6sH3z";

describe("AI environment", () => {
  it("defaults free users to the local OpenCode server", () => {
    expect(schema.parse({})).toMatchObject({
      AI_FREE_PROVIDER: "opencode",
      OPENCODE_BASE_URL: "http://localhost:4096",
      OPENCODE_SERVER_USERNAME: "opencode",
      OPENCODE_FREE_MODEL: "space-bunny-free",
      OPENCODE_FREE_MODEL_VARIANT: "low",
      OPENCODE_AGENT: "careerden",
      OPENCODE_TIMEOUT_MS: 120_000,
    });
  });

  it("rejects the development password and a local server in production", () => {
    const result = schema.safeParse({ NODE_ENV: "production" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual(
        expect.arrayContaining(["OPENCODE_BASE_URL", "OPENCODE_SERVER_PASSWORD"]),
      );
    }
  });

  it("accepts a private OpenCode server with a strong password in production", () => {
    expect(
      schema.safeParse({
        NODE_ENV: "production",
        OPENCODE_BASE_URL: "http://opencode:4096",
        OPENCODE_SERVER_PASSWORD: strongPassword,
      }).success,
    ).toBe(true);
  });

  it("rejects OpenCode's coding agent in production", () => {
    const result = schema.safeParse({
      NODE_ENV: "production",
      OPENCODE_AGENT: "build",
      OPENCODE_BASE_URL: "http://opencode:4096",
      OPENCODE_SERVER_PASSWORD: strongPassword,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual(["OPENCODE_AGENT"]);
    }
  });

  it("skips OpenCode checks when free users use the premium provider", () => {
    expect(schema.safeParse({ NODE_ENV: "production", AI_FREE_PROVIDER: "premium" }).success).toBe(
      true,
    );
  });
});
