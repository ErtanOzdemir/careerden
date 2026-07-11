import { describe, expect, it, vi } from "vitest";
import type { JobApplicationQueuePayload } from "@link2cv/domain";
import { BullMqJobApplicationQueue } from "./bullmq-job-application.queue.js";

describe("BullMqJobApplicationQueue", () => {
  it("uses the job application id for first-time enqueueing", async () => {
    const queue = createQueue();
    const payload = { jobApplicationId: "job-1" };

    await new BullMqJobApplicationQueue(queue).enqueue(payload);

    expect(queue.add).toHaveBeenCalledWith(
      "process",
      payload,
      expect.objectContaining({ jobId: "job-1" }),
    );
  });

  it("uses a supplied idempotency job ID for outbox delivery", async () => {
    const queue = createQueue();
    const payload = { jobApplicationId: "job-1" };

    await new BullMqJobApplicationQueue(queue).enqueue(payload, { jobId: "outbox-1" });

    expect(queue.getJob).toHaveBeenCalledWith("outbox-1");
    expect(queue.add).toHaveBeenCalledWith(
      "process",
      payload,
      expect.objectContaining({ jobId: "outbox-1" }),
    );
  });

  it("uses a retry-safe custom id when enqueueing after a retained failed job", async () => {
    const queue = createQueue({
      existingJobState: "failed",
    });
    const payload = { jobApplicationId: "job-1" };

    await new BullMqJobApplicationQueue(queue).enqueue(payload);

    expect(queue.add).toHaveBeenCalledWith(
      "process",
      payload,
      expect.objectContaining({
        jobId: expect.stringMatching(/^job-1-retry-\d+$/),
      }),
    );
  });

  it("uses a BullMQ-safe custom id when restarting jobs", async () => {
    const queue = createQueue();
    const payload = { jobApplicationId: "job-1" };

    await new BullMqJobApplicationQueue(queue).restart(payload);

    expect(queue.add).toHaveBeenCalledWith(
      "process",
      payload,
      expect.objectContaining({
        jobId: expect.stringMatching(/^job-1-retry-\d+$/),
      }),
    );
  });
});

function createQueue(options: { existingJobState?: string } = {}) {
  return {
    add: vi.fn<[], Promise<void>>(async () => undefined),
    close: vi.fn<[], Promise<void>>(async () => undefined),
    getJob: vi.fn(async () =>
      options.existingJobState
        ? {
            getState: vi.fn(async () => options.existingJobState),
          }
        : undefined,
    ),
  } as unknown as ConstructorParameters<typeof BullMqJobApplicationQueue>[0] & {
    add: ReturnType<typeof vi.fn<[string, JobApplicationQueuePayload, object], Promise<void>>>;
  };
}
