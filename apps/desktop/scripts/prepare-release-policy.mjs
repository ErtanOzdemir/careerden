import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const desktopDirectory = resolve(scriptDirectory, "..");
const outputPath = resolve(
  process.argv[2] ?? resolve(desktopDirectory, "release", "careerden-desktop-update-policy.json"),
);

const packageJson = JSON.parse(await readFile(resolve(desktopDirectory, "package.json"), "utf8"));
const policy = JSON.parse(await readFile(resolve(desktopDirectory, "release-policy.json"), "utf8"));

assertStableSemver(packageJson.version, "desktop package version");
assertPolicy(policy);

if (compareStableSemver(policy.minimumSupportedVersion, packageJson.version) > 0) {
  throw new Error(
    `minimumSupportedVersion ${policy.minimumSupportedVersion} cannot exceed release version ${packageJson.version}`,
  );
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(policy, null, 2)}\n`, "utf8");

function assertPolicy(value) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value.schemaVersion !== 1 ||
    typeof value.minimumSupportedVersion !== "string" ||
    Object.keys(value).some((key) => key !== "schemaVersion" && key !== "minimumSupportedVersion")
  ) {
    throw new Error(
      "release-policy.json must contain only schemaVersion 1 and minimumSupportedVersion",
    );
  }

  assertStableSemver(value.minimumSupportedVersion, "minimumSupportedVersion");
}

function assertStableSemver(version, label) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error(`${label} must be a stable semantic version (x.y.z), received ${version}`);
  }
}

function compareStableSemver(left, right) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);

  for (let index = 0; index < 3; index += 1) {
    const difference = leftParts[index] - rightParts[index];
    if (difference !== 0) return difference;
  }
  return 0;
}
