import { readFileSync } from "node:fs";
import { z } from "zod";

const desktopRuntimeConfigSchema = z
  .object({
    apiBaseUrl: z.string().trim().min(1),
    desktopUpdateRepository: z.string().trim().min(1).optional(),
  })
  .strict();

export interface DesktopRuntimeConfig {
  apiBaseUrl: string;
  desktopUpdateRepository?: string;
}

export function loadDesktopRuntimeConfig(options: {
  configPath: string;
  environment: NodeJS.ProcessEnv;
  isPackaged: boolean;
  readFile?: (path: string) => string;
}): DesktopRuntimeConfig {
  if (!options.isPackaged) {
    const desktopUpdateRepository = options.environment.DESKTOP_UPDATE_REPOSITORY?.trim();
    return {
      apiBaseUrl: normalizeDesktopApiBaseUrl(
        options.environment.DESKTOP_API_BASE_URL ??
          options.environment.VITE_API_BASE_URL ??
          "http://localhost:3000",
      ),
      ...(desktopUpdateRepository
        ? { desktopUpdateRepository: normalizeDesktopUpdateRepository(desktopUpdateRepository) }
        : {}),
    };
  }

  let payload: unknown;

  try {
    const readFile = options.readFile ?? ((path: string) => readFileSync(path, "utf8"));
    payload = JSON.parse(readFile(options.configPath)) as unknown;
  } catch (error) {
    throw new Error("Could not load the packaged desktop runtime configuration", {
      cause: error,
    });
  }

  const result = desktopRuntimeConfigSchema.safeParse(payload);
  if (!result.success) {
    throw new Error("The packaged desktop runtime configuration is invalid");
  }

  return {
    apiBaseUrl: normalizeDesktopApiBaseUrl(result.data.apiBaseUrl),
    ...(result.data.desktopUpdateRepository
      ? {
          desktopUpdateRepository: normalizeDesktopUpdateRepository(
            result.data.desktopUpdateRepository,
          ),
        }
      : {}),
  };
}

export function normalizeDesktopApiBaseUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value.trim());
  } catch (error) {
    throw new Error("Desktop API base URL must be a valid absolute URL", { cause: error });
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Desktop API base URL must use HTTP or HTTPS");
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new Error("Desktop API base URL cannot contain credentials, a query, or a fragment");
  }

  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
}

export function normalizeDesktopUpdateRepository(value: string): string {
  const repository = value.trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error("Desktop update repository must use the owner/repository format");
  }
  return repository;
}
