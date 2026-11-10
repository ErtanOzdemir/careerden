import { UnrecoverableError } from "bullmq";
import { describe, expect, it } from "vitest";
import { ApplicationError } from "@careerden/application";
import { toBullMqWorkerError } from "./bullmq-worker-error.js";

describe("toBullMqWorkerError", () => {
  it("makes typed application errors terminal", () => {
    const result = toBullMqWorkerError(new ApplicationError("not_found", "Template not found"));

    expect(result).toBeInstanceOf(UnrecoverableError);
    expect(result).toMatchObject({ message: "[not_found] Template not found" });
  });

  it("keeps unexpected errors retryable", () => {
    const error = new Error("Storage unavailable");

    expect(toBullMqWorkerError(error)).toBe(error);
  });
});
