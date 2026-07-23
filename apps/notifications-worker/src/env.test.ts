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
