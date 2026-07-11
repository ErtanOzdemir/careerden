import { UnrecoverableError } from "bullmq";
import { describe, expect, it } from "vitest";
import { ApplicationError } from "@link2cv/application";
import { toBullMqWorkerError } from "./bullmq-worker-error.js";

describe("toBullMqWorkerError", () => {
  it("makes typed application errors terminal", () => {
    const result = toBullMqWorkerError(
      new ApplicationError("not_found", "Follow-up no longer exists"),
    );

    expect(result).toBeInstanceOf(UnrecoverableError);
    expect(result).toMatchObject({ message: "[not_found] Follow-up no longer exists" });
  });

  it("keeps unexpected errors retryable", () => {
    const error = new Error("Database unavailable");
    expect(toBullMqWorkerError(error)).toBe(error);
  });
});
