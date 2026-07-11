import { UnrecoverableError } from "bullmq";
import { describe, expect, it } from "vitest";
import { ApplicationError } from "@link2cv/application";
import { toBullMqWorkerError } from "./bullmq-worker-error.js";

describe("toBullMqWorkerError", () => {
  it("makes typed application errors terminal", () => {
    const result = toBullMqWorkerError(
      new ApplicationError("validation", "Scrape data is required"),
    );

    expect(result).toBeInstanceOf(UnrecoverableError);
    expect(result).toMatchObject({ message: "[validation] Scrape data is required" });
  });

  it("keeps unexpected errors retryable", () => {
    const error = new Error("OpenAI unavailable");
    expect(toBullMqWorkerError(error)).toBe(error);
  });
});
