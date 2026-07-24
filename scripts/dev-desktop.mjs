import { spawn } from "node:child_process";
import console from "node:console";
import process from "node:process";

const commands = [
  ["@careerden/api-app", "dev", {}],
  ["@careerden/llm-worker", "dev", {}],
  ["@careerden/documents-worker", "dev", {}],
  ["@careerden/notifications-worker", "dev", {}],
  ["@careerden/web", "dev", { VITE_API_BASE_URL: "http://localhost:3000" }],
  [
    "@careerden/desktop",
    "dev",
    {
      NODE_ENV: "development",
      VITE_API_BASE_URL: "http://localhost:3000",
      VITE_DEV_SERVER_URL: "http://localhost:5173",
    },
  ],
];

const children = commands.map(([workspace, script, environment]) =>
  spawn("pnpm", ["--filter", workspace, script], {
    detached: process.platform !== "win32",
    env: { ...process.env, ...environment },
    stdio: "inherit",
  }),
);

let shuttingDown = false;

function stopChildren() {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue;

    try {
      if (process.platform === "win32") {
        child.kill("SIGTERM");
      } else {
        process.kill(-child.pid, "SIGTERM");
      }
    } catch (error) {
      if (error?.code !== "ESRCH") throw error;
    }
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopChildren();
  });
}

for (const child of children) {
  child.on("error", (error) => {
    console.error("Failed to start a desktop development process", error);
    process.exitCode = 1;
    stopChildren();
  });
  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      console.error(`A desktop development process exited (${signal ?? `code ${code}`})`);
      process.exitCode = code ?? 1;
      stopChildren();
    }
  });
}

await Promise.all(
  children.map(
    (child) =>
      new Promise((resolve) => {
        child.once("exit", resolve);
      }),
  ),
);
