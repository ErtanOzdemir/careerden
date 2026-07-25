import { createServer } from "node:http";
import type { Server, ServerResponse } from "node:http";
import type { Worker } from "bullmq";
import type { Knex } from "knex";

interface WorkerHealthRedisClient {
  ping(): Promise<string>;
}

export interface BullMqWorkerHealthServerOptions {
  database: Knex;
  host?: string;
  port: number;
  timeoutMs?: number;
  worker: Worker;
}

export interface BullMqWorkerHealthServer {
  close(): Promise<void>;
  port: number;
}

const defaultHost = "127.0.0.1";
const defaultTimeoutMs = 2_000;

export async function startBullMqWorkerHealthServer(
  options: BullMqWorkerHealthServerOptions,
): Promise<BullMqWorkerHealthServer> {
  let isShuttingDown = false;
  const server = createServer((request, response) => {
    if (request.method !== "GET") {
      writeJson(response, 405, { status: "method_not_allowed" });
      return;
    }

    if (request.url === "/health/live") {
      writeJson(response, isShuttingDown ? 503 : 200, {
        status: isShuttingDown ? "shutting_down" : "ok",
      });
      return;
    }

    if (request.url === "/health/ready") {
      void checkReadiness(options, isShuttingDown).then((result) => {
        writeJson(response, result.ready ? 200 : 503, {
          status: result.ready ? "ok" : "unhealthy",
          checks: result.checks,
        });
      });
      return;
    }

    writeJson(response, 404, { status: "not_found" });
  });

  await listen(server, options.port, options.host ?? defaultHost);

  return {
    port: getListeningPort(server),
    close: async () => {
      isShuttingDown = true;
      await close(server);
    },
  };
}

async function checkReadiness(options: BullMqWorkerHealthServerOptions, isShuttingDown: boolean) {
  const worker = !isShuttingDown && options.worker.isRunning() && !options.worker.isPaused();
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
  const [redis, database] = await Promise.all([
    checkWithTimeout(
      () =>
        options.worker.client.then((client) =>
          (client as unknown as WorkerHealthRedisClient).ping(),
        ),
      timeoutMs,
    ),
    checkWithTimeout(() => options.database.raw("select 1"), timeoutMs),
  ]);

  return {
    ready: worker && redis && database,
    checks: {
      worker,
      redis,
      database,
    },
  };
}

async function checkWithTimeout(
  check: () => PromiseLike<unknown>,
  timeoutMs: number,
): Promise<boolean> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      Promise.resolve().then(check),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("Worker health check timed out")), timeoutMs);
      }),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function listen(server: Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function getListeningPort(server: Server): number {
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Worker health server did not bind to a TCP port");
  }

  return address.port;
}

function writeJson(response: ServerResponse, statusCode: number, body: unknown) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}
