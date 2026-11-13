import { spawn } from "node:child_process";
import process from "node:process";

// Runs every package's tests through Turbo with half the cores, and two Vitest workers per package
// unless VITEST_MAX_WORKERS is set. Without the worker cap each Vitest starts one worker per core,
// and the oversubscribed jsdom and PGlite suites time out at random. Extra arguments go to Turbo.
const child = spawn(
  "pnpm",
  ["exec", "turbo", "run", "test", "--concurrency=50%", ...process.argv.slice(2)],
  {
    env: { ...process.env, VITEST_MAX_WORKERS: process.env.VITEST_MAX_WORKERS ?? "2" },
    shell: process.platform === "win32",
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
