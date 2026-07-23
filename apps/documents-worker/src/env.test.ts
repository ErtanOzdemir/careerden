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
