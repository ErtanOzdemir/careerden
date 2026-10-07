import { describe, expect, it, vi } from "vitest";
import type { ApplicationPackGenerationQueuePayload } from "../../../domain/job-applications/application-pack-generation.queue.js";
import { BullMqApplicationPackGenerationQueue } from "./bullmq-application-pack-generation.queue.js";

describe("BullMqApplicationPackGenerationQueue", () => {
  it("uses the generation attempt as the default idempotency key", async () => {
    const queue = createQueue();
    const payload = { jobApplicationId: "job-1", generationAttemptId: "attempt-1" };

    await new BullMqApplicationPackGenerationQueue(queue).enqueue(payload);

    expect(queue.add).toHaveBeenCalledWith(
      "generate",
      payload,
      expect.objectContaining({ jobId: "attempt-1", attempts: 3 }),
    );
  });

  it("uses the outbox event ID when supplied", async () => {
    const queue = createQueue();
    const payload = { jobApplicationId: "job-1", generationAttemptId: "attempt-1" };

    await new BullMqApplicationPackGenerationQueue(queue).enqueue(payload, { jobId: "event-1" });

    expect(queue.getJob).toHaveBeenCalledWith("event-1");
    expect(queue.add).toHaveBeenCalledWith(
      "generate",
      payload,
      expect.objectContaining({ jobId: "event-1" }),
    );
  });
});

function createQueue() {
  return {
    add: vi.fn<[], Promise<void>>(async () => undefined),
    close: vi.fn<[], Promise<void>>(async () => undefined),
    getJob: vi.fn(async () => undefined),
  } as unknown as ConstructorParameters<typeof BullMqApplicationPackGenerationQueue>[0] & {
    add: ReturnType<
      typeof vi.fn<[string, ApplicationPackGenerationQueuePayload, object], Promise<void>>
    >;
    getJob: ReturnType<typeof vi.fn>;
  };
}
