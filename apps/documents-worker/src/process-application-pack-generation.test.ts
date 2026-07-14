import { UnrecoverableError } from "bullmq";
import { ApplicationError } from "@link2cv/application";
import { describe, expect, it, vi } from "vitest";
import { processApplicationPackGeneration } from "./process-application-pack-generation.js";

const payload = { jobApplicationId: "job-1", generationAttemptId: "attempt-1" };

describe("processApplicationPackGeneration", () => {
  it("leaves transient failures generating while BullMQ still has retries", async () => {
    const failure = new Error("storage unavailable");
    const fail = { execute: vi.fn() };

    await expect(
      processApplicationPackGeneration({
        payload,
        attemptsMade: 0,
        maximumAttempts: 3,
        generate: { execute: vi.fn(async () => Promise.reject(failure)) },
        fail,
      }),
    ).rejects.toBe(failure);
    expect(fail.execute).not.toHaveBeenCalled();
  });

  it("records a terminal failure after the final retry", async () => {
    const failure = new Error("Gotenberg unavailable");
    const fail = { execute: vi.fn() };

    await expect(
      processApplicationPackGeneration({
        payload,
        attemptsMade: 2,
        maximumAttempts: 3,
        generate: { execute: vi.fn(async () => Promise.reject(failure)) },
        fail,
      }),
    ).rejects.toBe(failure);
    expect(fail.execute).toHaveBeenCalledWith(payload, "Gotenberg unavailable");
  });

  it("marks application validation errors unrecoverable immediately", async () => {
    const failure = new ApplicationError("validation", "Template is unavailable");
    const fail = { execute: vi.fn() };

    await expect(
      processApplicationPackGeneration({
        payload,
        attemptsMade: 0,
        maximumAttempts: 3,
        generate: { execute: vi.fn(async () => Promise.reject(failure)) },
        fail,
      }),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    expect(fail.execute).toHaveBeenCalledWith(payload, "Template is unavailable");
  });
});
