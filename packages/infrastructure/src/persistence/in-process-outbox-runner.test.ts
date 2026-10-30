import type { Knex } from "knex";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InProcessOutboxHandler } from "./in-process-outbox-runner.js";
import { InProcessOutboxRunner } from "./in-process-outbox-runner.js";
import { createPgliteDb } from "./pglite-knex.js";
import { runPostgresMigrations } from "./postgres-knex.js";
import { PostgresOutboxRepository } from "./postgres-outbox.repository.js";

const now = new Date("2026-10-29T10:00:00.000Z");

// Exercises the runner against the real outbox table through embedded PGlite.
describe("InProcessOutboxRunner", { timeout: 30_000 }, () => {
  let db: Knex;
  let outbox: PostgresOutboxRepository;
  const runners: InProcessOutboxRunner[] = [];

  beforeEach(async () => {
    db = createPgliteDb();
    await runPostgresMigrations(db);
    outbox = new PostgresOutboxRepository(db);
  });

  afterEach(async () => {
    await Promise.all(runners.splice(0).map((runner) => runner.close()));
    await db.destroy();
  });

  function createRunner(handlers: InProcessOutboxHandler[]) {
    const runner = new InProcessOutboxRunner(outbox, handlers, {
      now: () => now,
      onError: () => undefined,
    });
    runners.push(runner);
    return runner;
  }

  async function addEvent(type = "work.requested", payload: Record<string, unknown> = {}) {
    return outbox.add({ type, payload, availableAt: new Date(now.getTime() - 1_000) });
  }

  async function row(id: string) {
    return db("outbox_events").where({ id }).first();
  }

  async function processedCount(type: string) {
    const [{ count }] = await db("outbox_events")
      .where({ type })
      .whereNotNull("processed_at")
      .count<{ count: string | number }[]>({ count: "*" });
    return Number(count);
  }

  async function runOnce(runner: InProcessOutboxRunner) {
    await runner.poll();
    await runner.idle();
  }

  it("marks an event processed only after its handler finishes", async () => {
    const event = await addEvent("work.requested", { id: "a" });
    let finish!: () => void;
    const handle = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const runner = createRunner([{ name: "work", types: ["work.requested"], handle }]);

    await runner.poll();
    await vi.waitFor(() => expect(handle).toHaveBeenCalledOnce());
    expect((await row(event.id)).processed_at).toBeNull();
    finish();
    await runner.idle();

    expect(handle).toHaveBeenCalledWith(expect.objectContaining({ payload: { id: "a" } }));
    expect((await row(event.id)).processed_at).not.toBeNull();
  });

  it("schedules a retry with backoff after a recoverable failure", async () => {
    const event = await addEvent();
    const runner = createRunner([
      {
        name: "work",
        types: ["work.requested"],
        handle: async () => {
          throw new Error("provider timeout");
        },
      },
    ]);

    await runOnce(runner);
    const failed = await row(event.id);

    expect(failed).toMatchObject({ processed_at: null, dead_lettered_at: null, lease_owner: null });
    expect(failed.last_error).toBe("provider timeout");
    expect(new Date(failed.available_at)).toEqual(new Date(now.getTime() + 5_000));
  });

  it("dead-letters after the final attempt and runs the terminal failure hook once", async () => {
    const event = await addEvent();
    await db("outbox_events").where({ id: event.id }).update({ attempt_count: 2 });
    const onTerminalFailure = vi.fn(async () => undefined);
    const runner = createRunner([
      {
        name: "work",
        types: ["work.requested"],
        handle: async () => {
          throw new Error("still failing");
        },
        onTerminalFailure,
      },
    ]);

    await runOnce(runner);

    expect(onTerminalFailure).toHaveBeenCalledOnce();
    expect((await row(event.id)).dead_lettered_at).not.toBeNull();
    await runOnce(runner);
    expect(onTerminalFailure).toHaveBeenCalledOnce();
  });

  it("gives up immediately on unrecoverable errors", async () => {
    const event = await addEvent();
    const onTerminalFailure = vi.fn(async () => undefined);
    const runner = createRunner([
      {
        name: "work",
        types: ["work.requested"],
        handle: async () => {
          throw new TypeError("invalid payload");
        },
        isUnrecoverable: (error) => error instanceof TypeError,
        onTerminalFailure,
      },
    ]);

    await runOnce(runner);

    expect(onTerminalFailure).toHaveBeenCalledWith(
      expect.objectContaining({ id: event.id, attemptCount: 1 }),
      expect.any(TypeError),
    );
    expect((await row(event.id)).dead_lettered_at).not.toBeNull();
  });

  it("limits each handler to its concurrency and routes events by type", async () => {
    await Promise.all([
      addEvent("slow.requested"),
      addEvent("slow.requested"),
      addEvent("fast.requested"),
    ]);
    const releases: Array<() => void> = [];
    const slow = vi.fn(() => new Promise<void>((resolve) => releases.push(resolve)));
    const fast = vi.fn(async () => undefined);
    const runner = createRunner([
      { name: "slow", types: ["slow.requested"], concurrency: 1, handle: slow },
      { name: "fast", types: ["fast.requested"], handle: fast },
    ]);

    await runner.poll();
    await runner.poll();
    await vi.waitFor(() => expect(fast).toHaveBeenCalledOnce());
    expect(slow).toHaveBeenCalledTimes(1);
    releases.shift()?.();
    await vi.waitFor(async () => expect(await processedCount("slow.requested")).toBe(1));
    await runner.poll();
    await vi.waitFor(() => expect(slow).toHaveBeenCalledTimes(2));
    releases.shift()?.();
    await runner.idle();

    expect(await processedCount("slow.requested")).toBe(2);
  });

  it("reclaims events leased by a previous process on start", async () => {
    const event = await addEvent();
    await outbox.claimPending({
      types: ["work.requested"],
      leaseOwner: "previous-process",
      leaseDurationMs: 60 * 60 * 1000,
      limit: 10,
      now,
    });
    const handle = vi.fn(async () => undefined);
    const runner = createRunner([{ name: "work", types: ["work.requested"], handle }]);

    await runner.start();
    await runner.idle();

    expect(handle).toHaveBeenCalledWith(expect.objectContaining({ id: event.id, attemptCount: 2 }));
    expect((await row(event.id)).processed_at).not.toBeNull();
  });

  it("waits for in-flight work on close and claims nothing afterwards", async () => {
    await addEvent();
    let finish!: () => void;
    const handle = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const runner = createRunner([{ name: "work", types: ["work.requested"], handle }]);

    await runner.poll();
    await vi.waitFor(() => expect(handle).toHaveBeenCalledOnce());
    const closing = runner.close();
    finish();
    await closing;
    await addEvent();
    await runner.poll();

    expect(handle).toHaveBeenCalledOnce();
  });
});
