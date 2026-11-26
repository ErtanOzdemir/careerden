import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { assertStableSemver, assertUpdatePolicy } from "./desktop-release-verification.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const desktopDirectory = resolve(scriptDirectory, "..");

// parseArgs rejects unknown flags, so a mistyped option is never taken as the output path.
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { help: { type: "boolean", short: "h" } },
});
if (values.help || positionals.length > 1) {
  console.error("Usage: prepare-release-policy.mjs [output-path]");
  process.exit(values.help ? 0 : 2);
}

const outputPath = resolve(
  positionals[0] ?? resolve(desktopDirectory, "release", "careerden-desktop-update-policy.json"),
);

const packageJson = JSON.parse(await readFile(resolve(desktopDirectory, "package.json"), "utf8"));
const policy = JSON.parse(await readFile(resolve(desktopDirectory, "release-policy.json"), "utf8"));

assertStableSemver(packageJson.version, "desktop package version");
assertUpdatePolicy(policy, packageJson.version);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(policy, null, 2)}\n`, "utf8");
