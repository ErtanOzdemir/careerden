import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const desktopDirectory = resolve(scriptDirectory, "..");
const runtimeConfigModule = await import(
  pathToFileURL(resolve(desktopDirectory, "dist", "main", "desktop-runtime-config.js")).toString()
);
const edition = runtimeConfigModule.normalizeDesktopEdition(process.env.CAREERDEN_EDITION);
const configuredApiBaseUrl = process.env.DESKTOP_API_BASE_URL?.trim();
const configuredUpdateRepository = process.env.DESKTOP_UPDATE_REPOSITORY?.trim();
const requireConfiguredApiBaseUrl = process.env.CAREERDEN_REQUIRE_DESKTOP_API_BASE_URL === "true";
const requireConfiguredUpdateRepository =
  process.env.CAREERDEN_REQUIRE_DESKTOP_UPDATE_REPOSITORY === "true";

if (edition === "local" && configuredApiBaseUrl) {
  throw new Error("DESKTOP_API_BASE_URL must not be set for local edition builds");
}
if (edition === "cloud" && requireConfiguredApiBaseUrl && !configuredApiBaseUrl) {
  throw new Error("DESKTOP_API_BASE_URL is required for desktop release builds");
}
if (requireConfiguredUpdateRepository && !configuredUpdateRepository) {
  throw new Error("DESKTOP_UPDATE_REPOSITORY is required for desktop release builds");
}

const apiBaseUrl =
  edition === "cloud"
    ? runtimeConfigModule.normalizeDesktopApiBaseUrl(
        configuredApiBaseUrl || "http://localhost:3000",
      )
    : undefined;
const desktopUpdateRepository = configuredUpdateRepository
  ? runtimeConfigModule.normalizeDesktopUpdateRepository(configuredUpdateRepository)
  : undefined;
const preloadSource = resolve(desktopDirectory, "src", "preload", "index.cjs");
const preloadOutput = resolve(desktopDirectory, "dist", "preload", "index.cjs");
const configOutput = resolve(desktopDirectory, "dist", "main", "desktop-runtime-config.json");

await Promise.all([
  mkdir(dirname(preloadOutput), { recursive: true }),
  mkdir(dirname(configOutput), { recursive: true }),
]);
await Promise.all([
  copyFile(preloadSource, preloadOutput),
  writeFile(
    configOutput,
    `${JSON.stringify(
      {
        edition,
        ...(apiBaseUrl ? { apiBaseUrl } : {}),
        ...(desktopUpdateRepository ? { desktopUpdateRepository } : {}),
      },
      null,
      2,
    )}\n`,
    "utf8",
  ),
]);
