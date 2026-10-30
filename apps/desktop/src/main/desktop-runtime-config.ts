import { readFileSync } from "node:fs";
import { z } from "zod";

export const desktopEditions = ["cloud", "local"] as const;
export type DesktopEdition = (typeof desktopEditions)[number];

const desktopUpdateRepositorySchema = z.string().trim().min(1).optional();
const desktopRuntimeConfigSchema = z.union([
  z
    .object({
      // Builds from before editions existed omit it and are cloud builds.
      edition: z.literal("cloud").optional(),
      apiBaseUrl: z.string().trim().min(1),
      desktopUpdateRepository: desktopUpdateRepositorySchema,
    })
    .strict(),
  z
    .object({
      edition: z.literal("local"),
      desktopUpdateRepository: desktopUpdateRepositorySchema,
    })
    .strict(),
]);

export type DesktopRuntimeConfig =
  | { edition: "cloud"; apiBaseUrl: string; desktopUpdateRepository?: string }
  | {
      edition: "local";
      desktopUpdateRepository?: string;
      // Unpackaged runs only: a fixed backend port and token the Vite dev proxy can target.
      developmentBackend?: { port: number; sessionToken: string };
    };

export function loadDesktopRuntimeConfig(options: {
  configPath: string;
  environment: NodeJS.ProcessEnv;
  isPackaged: boolean;
  readFile?: (path: string) => string;
}): DesktopRuntimeConfig {
  if (!options.isPackaged) {
    return loadDevelopmentRuntimeConfig(options.environment);
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

  const desktopUpdateRepository = result.data.desktopUpdateRepository
    ? {
        desktopUpdateRepository: normalizeDesktopUpdateRepository(
          result.data.desktopUpdateRepository,
        ),
      }
    : {};

  if (result.data.edition === "local") {
    return { edition: "local", ...desktopUpdateRepository };
  }

  return {
    edition: "cloud",
    apiBaseUrl: normalizeDesktopApiBaseUrl(result.data.apiBaseUrl),
    ...desktopUpdateRepository,
  };
}

function loadDevelopmentRuntimeConfig(environment: NodeJS.ProcessEnv): DesktopRuntimeConfig {
  const repository = environment.DESKTOP_UPDATE_REPOSITORY?.trim();
  const desktopUpdateRepository = repository
    ? { desktopUpdateRepository: normalizeDesktopUpdateRepository(repository) }
    : {};
  const edition = normalizeDesktopEdition(environment.CAREERDEN_EDITION);

  if (edition === "local") {
    const port = environment.CAREERDEN_LOCAL_DEV_PORT?.trim();
    const sessionToken = environment.CAREERDEN_LOCAL_DEV_TOKEN?.trim();
    if (Boolean(port) !== Boolean(sessionToken)) {
      throw new Error(
        "Set both CAREERDEN_LOCAL_DEV_PORT and CAREERDEN_LOCAL_DEV_TOKEN, or neither",
      );
    }

    return {
      edition: "local",
      ...desktopUpdateRepository,
      ...(port && sessionToken
        ? { developmentBackend: { port: normalizeLocalDevelopmentPort(port), sessionToken } }
        : {}),
    };
  }

  return {
    edition: "cloud",
    apiBaseUrl: normalizeDesktopApiBaseUrl(
      environment.DESKTOP_API_BASE_URL ?? environment.VITE_API_BASE_URL ?? "http://localhost:3000",
    ),
    ...desktopUpdateRepository,
  };
}

export function normalizeDesktopEdition(value: string | undefined): DesktopEdition {
  const edition = value?.trim() || "cloud";
  if (!desktopEditions.some((candidate) => candidate === edition)) {
    throw new Error(`Desktop edition must be one of: ${desktopEditions.join(", ")}`);
  }
  return edition as DesktopEdition;
}

function normalizeLocalDevelopmentPort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
    throw new Error("CAREERDEN_LOCAL_DEV_PORT must be a port between 1024 and 65535");
  }
  return port;
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
