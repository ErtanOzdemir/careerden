import type { Worker } from "bullmq";
import type { Knex } from "knex";
import { describe, expect, it, vi } from "vitest";
import { startBullMqWorkerHealthServer } from "./bullmq-worker-health.server.js";

describe("startBullMqWorkerHealthServer", () => {
  it("reports a live and ready worker", async () => {
    const { database, redis, worker } = createDependencies();
    const server = await startBullMqWorkerHealthServer({
      database,
      port: 0,
      worker,
    });

    try {
      const liveResponse = await fetch(`http://127.0.0.1:${server.port}/health/live`);
      const readyResponse = await fetch(`http://127.0.0.1:${server.port}/health/ready`);

      expect(liveResponse.status).toBe(200);
      await expect(liveResponse.json()).resolves.toEqual({ status: "ok" });
      expect(readyResponse.status).toBe(200);
      await expect(readyResponse.json()).resolves.toEqual({
        status: "ok",
        checks: {
          worker: true,
          redis: true,
          database: true,
        },
      });
      expect(redis.ping).toHaveBeenCalledOnce();
      expect(database.raw).toHaveBeenCalledWith("select 1");
    } finally {
      await server.close();
    }
  });

  it("reports each failed readiness dependency without exposing error details", async () => {
    const { database, worker } = createDependencies({
      databaseError: new Error("database credentials"),
      paused: true,
      redisError: new Error("redis credentials"),
    });
    const server = await startBullMqWorkerHealthServer({
      database,
      port: 0,
      worker,
    });

    try {
      const response = await fetch(`http://127.0.0.1:${server.port}/health/ready`);

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        status: "unhealthy",
        checks: {
          worker: false,
          redis: false,
          database: false,
        },
      });
    } finally {
      await server.close();
    }
  });

  it("returns bounded responses for unsupported routes and methods", async () => {
    const { database, worker } = createDependencies();
    const server = await startBullMqWorkerHealthServer({
      database,
      port: 0,
      worker,
    });

    try {
      const missingResponse = await fetch(`http://127.0.0.1:${server.port}/missing`);
      const methodResponse = await fetch(`http://127.0.0.1:${server.port}/health/live`, {
        method: "POST",
      });

      expect(missingResponse.status).toBe(404);
      await expect(missingResponse.json()).resolves.toEqual({ status: "not_found" });
      expect(methodResponse.status).toBe(405);
      await expect(methodResponse.json()).resolves.toEqual({ status: "method_not_allowed" });
    } finally {
      await server.close();
    }
  });

  it("bounds dependency checks with a timeout", async () => {
    const { database, worker } = createDependencies({ databaseNeverResolves: true });
    const server = await startBullMqWorkerHealthServer({
      database,
      port: 0,
      timeoutMs: 10,
      worker,
    });

    try {
      const response = await fetch(`http://127.0.0.1:${server.port}/health/ready`);

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        status: "unhealthy",
        checks: {
          worker: true,
          redis: true,
          database: false,
        },
      });
    } finally {
      await server.close();
    }
  });
});

function createDependencies(
  options: {
    databaseError?: Error;
    databaseNeverResolves?: boolean;
    paused?: boolean;
    redisError?: Error;
    running?: boolean;
  } = {},
) {
  const redis = {
    ping: options.redisError
      ? vi.fn().mockRejectedValue(options.redisError)
      : vi.fn().mockResolvedValue("PONG"),
  };
  const database = {
    raw: options.databaseNeverResolves
      ? vi.fn().mockReturnValue(new Promise(() => undefined))
      : options.databaseError
        ? vi.fn().mockRejectedValue(options.databaseError)
        : vi.fn().mockResolvedValue({ rows: [{ result: 1 }] }),
  };
  const worker = {
    client: Promise.resolve(redis),
    isPaused: vi.fn().mockReturnValue(options.paused ?? false),
    isRunning: vi.fn().mockReturnValue(options.running ?? true),
  };

  return {
    database: database as unknown as Knex,
    redis,
    worker: worker as unknown as Worker,
  };
}
