import { execFileSync } from "node:child_process";
import { cpSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const packageDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDirectory = join(packageDirectory, "dist");
const require = createRequire(import.meta.url);
const typescriptCli = require.resolve("typescript/bin/tsc");

rmSync(distDirectory, { force: true, recursive: true });
execFileSync(process.execPath, [typescriptCli, "-p", "tsconfig.json"], {
  cwd: packageDirectory,
  stdio: "inherit",
});

cpSync(
  join(packageDirectory, "src/documents/templates"),
  join(distDirectory, "documents/templates"),
  { recursive: true },
);
cpSync(
  join(packageDirectory, "src/persistence/postgres-migrations"),
  join(distDirectory, "persistence/postgres-migrations"),
  { recursive: true },
);
