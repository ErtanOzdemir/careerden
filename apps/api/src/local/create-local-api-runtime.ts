import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Express } from "express";
import type { Knex } from "knex";
import {
  AnalyzeScrapedJobUseCase,
  ApplicationError,
  DeliverFollowUpReminderUseCase,
  ExpireStaleCreditReservationsUseCase,
  ExtractJobRequirementsUseCase,
  FailApplicationPackGenerationUseCase,
  FinalizeJobApplicationAnalysisFailureUseCase,
  GenerateDocumentsUseCase,
  GenerateRequestedApplicationPackUseCase,
  RunMatchAnalysisUseCase,
  analysisFailureFromError,
  restoreFollowUpReminders,
} from "@careerden/application";
import type { AiGenerateParams, AiProvider, DocumentRenderer } from "@careerden/domain";
import { AiProviderError, outboxEventTypes } from "@careerden/domain";
import type {
  AiProviderSelection,
  AiProviderSelectionSource,
  ClaimedOutboxEvent,
  InProcessOutboxHandler,
} from "@careerden/infrastructure";
import {
  AiProviderNotConfiguredError,
  HtmlTemplateRenderer,
  InMemoryJobApplicationChangeBus,
  InMemoryNotificationChangeBus,
  InProcessFollowUpReminderQueue,
  InProcessOutboxRunner,
  LocalFileStorage,
  PostgresFollowUpReminderRepository,
  PostgresJobApplicationRepository,
  PostgresNotificationRepository,
  PostgresOutboxRepository,
  PostgresPersistenceUnitOfWork,
  PostgresReminderOutboxDispatcher,
  PostgresUserProfileRepository,
  ResolvingAiProvider,
  defaultRetryDelayMs,
} from "@careerden/infrastructure";
import { createApiApp } from "../api-app.js";
import { UnmeteredCreditRepository } from "../application/billing/unmetered-credit-repository.js";
import type { AuthenticatedUser } from "../auth/session.middleware.js";
import {
  prepareLocalDatabase,
  type LocalDataSnapshotPolicy,
} from "../infrastructure/persistence/prepare-local-database.js";
import { HttpRemoteImageFetcher } from "../infrastructure/scraping/http-remote-image.fetcher.js";
import { createLocalFileRouter } from "./local-files.routes.js";
import { localSession } from "./local-session.middleware.js";

// No name or email: the first profile starts blank so placeholders never reach generated documents.
export const localUser: AuthenticatedUser = {
  id: "local-user",
  email: "",
  name: "",
};

export interface LocalApiRuntimeOptions {
  // Directory owned by this runtime; holds the database and stored files.
  dataDir: string;
  // Per-launch secret the desktop shell sends on every request.
  sessionToken: string;
  pdfRenderer: DocumentRenderer;
  aiProviderSelection: AiProviderSelectionSource;
  // Test seam for the provider built from a selection.
  createAiProvider?: (selection: AiProviderSelection) => AiProvider;
  backgroundPollIntervalMs?: number;
  // Copies the data to the backups folder before migrations may change it. The desktop app
  // always passes it; scripts and tests that open throwaway data may leave it out.
  dataSnapshots?: LocalDataSnapshotPolicy;
}

export interface LocalApiRuntime {
  app: Express;
  db: Knex;
  // The newest migration the database is at, for diagnostics.
  lastMigration: string | undefined;
  close: () => Promise<void>;
}

// Composes the API, its background work, and embedded storage in one process for the local
// edition: PGlite instead of PostgreSQL, in-process work instead of Redis and BullMQ workers,
// the local disk instead of object storage, user-supplied AI keys, and no accounts or billing.
export async function createLocalApiRuntime(
  options: LocalApiRuntimeOptions,
): Promise<LocalApiRuntime> {
  // PGlite creates only its own directory, not missing parents.
  await mkdir(options.dataDir, { recursive: true });
  // Throws LocalDatabaseStartupError when the database cannot be opened or migrated.
  const { db, lastMigration } = await prepareLocalDatabase(options.dataDir, options.dataSnapshots);
  await db("user")
    .insert({ id: localUser.id, name: localUser.name, email: localUser.email })
    .onConflict("id")
    .ignore();

  const changeBus = new InMemoryJobApplicationChangeBus();
  const notificationChangeBus = new InMemoryNotificationChangeBus();
  const jobApplications = new PostgresJobApplicationRepository(db);
  const notifications = new PostgresNotificationRepository(db);
  const profiles = new PostgresUserProfileRepository(db);
  const reminders = new PostgresFollowUpReminderRepository(db);
  const outbox = new PostgresOutboxRepository(db);
  const unitOfWork = new PostgresPersistenceUnitOfWork(db, changeBus, notificationChangeBus, {
    decorateCredits: (credits) => new UnmeteredCreditRepository(credits),
  });
  const storage = new LocalFileStorage({
    rootDir: join(options.dataDir, "files"),
    signingKey: randomBytes(32).toString("base64url"),
    urlPathPrefix: "/api/files",
  });
  const aiProvider = new ResolvingAiProvider(
    options.aiProviderSelection,
    ...(options.createAiProvider ? [options.createAiProvider] : []),
  );
  const pdfRenderer = options.pdfRenderer;

  const app = createApiApp({
    jobApplications,
    notifications,
    profiles,
    unitOfWork,
    storage,
    pdfRenderer,
    remoteImageFetcher: new HttpRemoteImageFetcher(),
    jobApplicationChanges: changeBus,
    notificationChanges: notificationChangeBus,
    aiProvider: new ConfigurationAwareAiProvider(aiProvider),
    aiAvailability: aiProvider,
    http: {
      enableHsts: false,
      mountRawRoutes: (rawApp) => {
        rawApp.use("/files", createLocalFileRouter(storage));
      },
      authenticate: localSession(options.sessionToken, localUser),
    },
  });

  const analyze = new AnalyzeScrapedJobUseCase(
    jobApplications,
    profiles,
    new RunMatchAnalysisUseCase(aiProvider),
    unitOfWork,
    new ExtractJobRequirementsUseCase(aiProvider),
  );
  const finalizeAnalysisFailure = new FinalizeJobApplicationAnalysisFailureUseCase(unitOfWork);
  const generateApplicationPack = new GenerateRequestedApplicationPackUseCase(
    jobApplications,
    profiles,
    new GenerateDocumentsUseCase(
      new HtmlTemplateRenderer(),
      pdfRenderer,
      storage,
      jobApplications,
      profiles,
    ),
    unitOfWork,
  );
  const failApplicationPack = new FailApplicationPackGenerationUseCase(unitOfWork);
  // A bad key, an empty balance, or a removed model fails the same way on every try.
  const isUnrecoverable = (error: unknown) =>
    error instanceof ApplicationError ||
    error instanceof AiProviderNotConfiguredError ||
    error instanceof InvalidOutboxPayloadError ||
    (error instanceof AiProviderError && !error.retryable);

  const handlers: InProcessOutboxHandler[] = [
    {
      name: "analysis",
      types: [outboxEventTypes.jobApplicationAnalysisRequested],
      concurrency: 2,
      handle: async (event) => {
        try {
          await analyze.execute(analysisPayload(event));
        } catch (error) {
          logAiProviderError(error);
          throw error;
        }
      },
      isUnrecoverable,
      // The SDK already retried within seconds; a rate limit needs minutes to lift.
      retryDelayMs: (attempt, error) =>
        error instanceof AiProviderError && error.category === "rate_limited"
          ? 60_000 * 2 ** Math.max(0, attempt - 1)
          : defaultRetryDelayMs(attempt),
      onTerminalFailure: async (event, error) => {
        await finalizeAnalysisFailure.execute({
          ...analysisPayload(event),
          ...analysisFailureFromError(error),
        });
      },
    },
    {
      name: "application pack",
      types: [outboxEventTypes.applicationPackGenerationRequested],
      handle: (event) => generateApplicationPack.execute(applicationPackPayload(event)),
      isUnrecoverable,
      onTerminalFailure: async (event, error) => {
        await failApplicationPack.execute(
          applicationPackPayload(event),
          error instanceof Error ? error.message : "Unknown document generation error",
        );
      },
    },
    {
      name: "storage cleanup",
      types: [outboxEventTypes.storageDelete],
      maximumAttempts: 20,
      retryDelayMs: (attempt) => Math.min(1_000 * 2 ** (attempt - 1), 5 * 60_000),
      handle: (event) => storage.delete(requirePayloadString(event, "fileId")),
      isUnrecoverable: (error) => error instanceof InvalidOutboxPayloadError,
    },
    {
      // The local edition sends no email; reminders surface as in-app and desktop notifications.
      name: "reminder email",
      types: [outboxEventTypes.followUpReminderEmail],
      handle: async () => undefined,
    },
  ];
  const runner = new InProcessOutboxRunner(outbox, handlers, {
    ...(options.backgroundPollIntervalMs
      ? { pollIntervalMs: options.backgroundPollIntervalMs }
      : {}),
  });

  const deliverReminder = new DeliverFollowUpReminderUseCase(reminders, unitOfWork);
  const reminderQueue = new InProcessFollowUpReminderQueue({
    deliver: (payload) => deliverReminder.execute(payload),
    onFailed: (payload, error) => {
      console.error(`Local runtime failed follow-up reminder ${payload.followUpId}`, error);
    },
  });
  const reminderOutbox = new PostgresReminderOutboxDispatcher(outbox, reminders, reminderQueue);
  const expireStaleReservations = new ExpireStaleCreditReservationsUseCase(unitOfWork);

  await runner.start();
  await restoreFollowUpReminders(reminders, reminderQueue);
  const reminderOutboxTask = createSerialTask("follow-up reminder outbox", () =>
    reminderOutbox.dispatchPending(),
  );
  const expireReservationsTask = createSerialTask("stale analysis recovery", () =>
    expireStaleReservations.execute(),
  );
  await reminderOutboxTask();
  await expireReservationsTask();
  const intervals = [
    setInterval(reminderOutboxTask, options.backgroundPollIntervalMs ?? 1_000),
    setInterval(expireReservationsTask, 60_000),
  ];

  return {
    app,
    db,
    lastMigration,
    close: async () => {
      for (const interval of intervals) clearInterval(interval);
      await runner.close();
      await reminderQueue.close();
      await Promise.all([changeBus.close(), notificationChangeBus.close()]);
      await db.destroy();
    },
  };
}

// Reports a missing key on the interactive AI routes as a client error rather than a server fault.
class ConfigurationAwareAiProvider implements AiProvider {
  constructor(private readonly inner: AiProvider) {}

  async generate<T>(params: AiGenerateParams<T>): Promise<T> {
    try {
      return await this.inner.generate(params);
    } catch (error) {
      if (error instanceof AiProviderNotConfiguredError) {
        throw new ApplicationError("ai_provider_not_configured", error.message);
      }
      if (error instanceof AiProviderError) {
        logAiProviderError(error);
        throw new ApplicationError("ai_provider_error", error.message, {
          aiFailure: error.toFailure(),
        });
      }
      throw error;
    }
  }
}

// Provider, status code, and category only: never the key, the prompt, or the provider's response.
function logAiProviderError(error: unknown): void {
  if (!(error instanceof AiProviderError)) return;
  console.warn("AI provider call failed", {
    event: "ai.provider_error",
    ...error.toFailure(),
    retryable: error.retryable,
  });
}

class InvalidOutboxPayloadError extends Error {
  constructor(key: string) {
    super(`Invalid outbox payload: ${key}`);
    this.name = "InvalidOutboxPayloadError";
  }
}

function requirePayloadString(event: ClaimedOutboxEvent, key: string): string {
  const value = event.payload[key];
  if (typeof value !== "string") throw new InvalidOutboxPayloadError(key);
  return value;
}

function analysisPayload(event: ClaimedOutboxEvent) {
  return {
    jobApplicationId: requirePayloadString(event, "jobApplicationId"),
    analysisAttemptId: requirePayloadString(event, "analysisAttemptId"),
  };
}

function applicationPackPayload(event: ClaimedOutboxEvent) {
  return {
    jobApplicationId: requirePayloadString(event, "jobApplicationId"),
    generationAttemptId: requirePayloadString(event, "generationAttemptId"),
  };
}

function createSerialTask(name: string, run: () => Promise<unknown>) {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    try {
      await run();
    } catch (error) {
      console.error(`Local runtime failed ${name}`, error);
    } finally {
      running = false;
    }
  };
}
