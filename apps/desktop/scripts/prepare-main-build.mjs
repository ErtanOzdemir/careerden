import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const desktopDirectory = resolve(scriptDirectory, "..");
const runtimeConfigModule = await import(
  pathToFileURL(resolve(desktopDirectory, "dist", "main", "desktop-runtime-config.js")).toString()
);
const configuredApiBaseUrl = process.env.DESKTOP_API_BASE_URL?.trim();
const requireConfiguredApiBaseUrl = process.env.LINK2CV_REQUIRE_DESKTOP_API_BASE_URL === "true";

if (requireConfiguredApiBaseUrl && !configuredApiBaseUrl) {
  throw new Error("DESKTOP_API_BASE_URL is required for desktop release builds");
}

const apiBaseUrl = runtimeConfigModule.normalizeDesktopApiBaseUrl(
  configuredApiBaseUrl || "http://localhost:3000",
);
const preloadSource = resolve(desktopDirectory, "src", "preload", "index.cjs");
const preloadOutput = resolve(desktopDirectory, "dist", "preload", "index.cjs");
const configOutput = resolve(desktopDirectory, "dist", "main", "desktop-runtime-config.json");

await Promise.all([
  mkdir(dirname(preloadOutput), { recursive: true }),
  mkdir(dirname(configOutput), { recursive: true }),
]);
await Promise.all([
  copyFile(preloadSource, preloadOutput),
  writeFile(configOutput, `${JSON.stringify({ apiBaseUrl }, null, 2)}\n`, "utf8"),
]);
