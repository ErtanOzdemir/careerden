import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import process from "node:process";

// Starts the web dev server and the local edition desktop app without Docker services. Both share
// a fixed backend port and a per-run token so the Vite proxy can reach the desktop's local backend.
const child = spawn(
  "pnpm",
  ["exec", "turbo", "run", "dev", "--filter=@careerden/web", "--filter=@careerden/desktop"],
  {
    env: {
      ...process.env,
      CAREERDEN_EDITION: "local",
      VITE_CAREERDEN_EDITION: "local",
      CAREERDEN_LOCAL_DEV_PORT: process.env.CAREERDEN_LOCAL_DEV_PORT ?? "3010",
      CAREERDEN_LOCAL_DEV_TOKEN: randomBytes(24).toString("base64url"),
    },
    shell: process.platform === "win32",
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
