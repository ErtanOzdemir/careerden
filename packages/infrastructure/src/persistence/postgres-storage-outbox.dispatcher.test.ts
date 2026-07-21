import { describe, expect, it, vi } from "vitest";
import type { FileStorage, OutboxEvent } from "@careerden/domain";
import type { PostgresOutboxRepository } from "./postgres-outbox.repository.js";
import { PostgresStorageOutboxDispatcher } from "./postgres-storage-outbox.dispatcher.js";

describe("PostgresStorageOutboxDispatcher", () => {
  it("deletes the object before marking cleanup processed", async () => {
    const calls: string[] = [];
    const outbox = createOutbox({
      markProcessed: vi.fn(async () => {
        calls.push("processed");
        return true;
      }),
    });
    const storage = createStorage({
      delete: vi.fn(async () => {
        calls.push("deleted");
      }),
    });

    await new PostgresStorageOutboxDispatcher(outbox, storage).dispatchPending();

    expect(storage.delete).toHaveBeenCalledWith("files/cv.pdf");
    expect(calls).toEqual(["deleted", "processed"]);
  });

  it("retries cleanup when storage is unavailable", async () => {
    const outbox = createOutbox();
    const storage = createStorage({
      delete: vi.fn(async () => {
        throw new Error("storage unavailable");
      }),
    });

    await new PostgresStorageOutboxDispatcher(outbox, storage).dispatchPending();

    expect(outbox.markProcessed).not.toHaveBeenCalled();
    expect(outbox.markFailed).toHaveBeenCalledWith(
      "event-1",
      expect.any(String),
      "storage unavailable",
      expect.any(Date),
    );
  });
});

function createOutbox(overrides: Record<string, unknown> = {}): PostgresOutboxRepository {
  const event: OutboxEvent = {
    id: "event-1",
    type: "storage.delete",
    aggregateId: "files/cv.pdf",
    payload: { fileId: "files/cv.pdf" },
    attemptCount: 1,
  };
  return {
    claimPending: vi.fn(async (input: { leaseOwner: string }) => [
      { ...event, leaseOwner: input.leaseOwner },
    ]),
    markProcessed: vi.fn(async () => true),
    markFailed: vi.fn(async () => true),
    ...overrides,
  } as unknown as PostgresOutboxRepository;
}

function createStorage(overrides: Partial<FileStorage> = {}): FileStorage {
  return {
    put: vi.fn(),
    get: vi.fn(),
    getSignedUrl: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  } as FileStorage;
}
