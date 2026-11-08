import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { assertStableSemver, assertUpdatePolicy } from "./desktop-release-verification.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const desktopDirectory = resolve(scriptDirectory, "..");
const outputPath = resolve(
  process.argv[2] ?? resolve(desktopDirectory, "release", "careerden-desktop-update-policy.json"),
);

const packageJson = JSON.parse(await readFile(resolve(desktopDirectory, "package.json"), "utf8"));
const policy = JSON.parse(await readFile(resolve(desktopDirectory, "release-policy.json"), "utf8"));

assertStableSemver(packageJson.version, "desktop package version");
assertUpdatePolicy(policy, packageJson.version);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(policy, null, 2)}\n`, "utf8");
