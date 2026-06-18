import type {
  DocumentRenderer,
  DocxTemplateRenderer,
  FileStorage,
  JobApplicationQueue,
  JobApplicationRepository,
  TemplateRenderer,
  UserProfileRepository,
} from "@link2cv/domain";
import {
  BullMqJobApplicationQueue,
  createFileStorage,
  createDb,
  DocxtemplaterTemplateRenderer,
  HtmlTemplateRenderer,
  InMemoryJobApplicationQueue,
  InMemoryJobApplicationRepository,
  InMemoryUserProfileRepository,
  LinkedInSessionManager,
  PlaywrightPdfRenderer,
  PostgresJobApplicationRepository,
  PostgresUserProfileRepository,
  UnavailableJobApplicationQueue,
} from "@link2cv/infrastructure";

export interface ApiAppOptions {
  databaseUrl?: string;
  linkedInSessionSecret?: string;
  linkedInSessionStorageDir?: string;
  redisUrl?: string;
  rustFsEndpoint?: string;
  rustFsAccessKey?: string;
  rustFsSecretKey?: string;
  rustFsBucket?: string;
  rustFsRegion?: string;
  rustFsPublicEndpoint?: string;
}

export interface ApiDependencies {
  profiles: UserProfileRepository;
  jobApplications: JobApplicationRepository;
  queue: JobApplicationQueue;
  storage: FileStorage;
  templates: TemplateRenderer;
  documents: DocumentRenderer;
  docxTemplates: DocxTemplateRenderer;
  linkedInSessionManager: LinkedInSessionManager;
}

export function createApiDependencies(options: ApiAppOptions): ApiDependencies {
  const db = options.databaseUrl ? createDb(options.databaseUrl) : undefined;

  const profiles = db ? new PostgresUserProfileRepository(db) : new InMemoryUserProfileRepository();

  const jobApplications = db
    ? new PostgresJobApplicationRepository(db)
    : new InMemoryJobApplicationRepository();

  const queue = createQueue({
    redisUrl: options.redisUrl,
    requiresPersistentQueue: Boolean(db),
  });

  const storage = createFileStorage({
    endpoint: options.rustFsEndpoint ?? "http://localhost:9000",
    accessKeyId: options.rustFsAccessKey ?? "rustfsadmin",
    secretAccessKey: options.rustFsSecretKey ?? "rustfsadmin",
    bucket: options.rustFsBucket ?? "link2cv-files",
    region: options.rustFsRegion ?? "us-east-1",
    publicEndpoint: options.rustFsPublicEndpoint,
  });
  const templates = new HtmlTemplateRenderer();
  const documents = new PlaywrightPdfRenderer();
  const docxTemplates = new DocxtemplaterTemplateRenderer();

  const linkedInSessionManager = new LinkedInSessionManager(
    options.linkedInSessionStorageDir ?? "./storage/linkedin-session",
    options.linkedInSessionSecret ?? "dev-only-linkedin-session-secret",
  );

  return {
    profiles,
    jobApplications,
    queue,
    storage,
    templates,
    documents,
    docxTemplates,
    linkedInSessionManager,
  };
}

function createQueue(input: {
  redisUrl?: string;
  requiresPersistentQueue: boolean;
}): JobApplicationQueue {
  if (!input.redisUrl && input.requiresPersistentQueue) {
    return new UnavailableJobApplicationQueue(
      "REDIS_URL is required to enqueue job processing when using PostgreSQL. Start Redis and set REDIS_URL=redis://localhost:6379.",
    );
  }

  if (!input.redisUrl) {
    return new InMemoryJobApplicationQueue();
  }

  const redisUrl = new URL(input.redisUrl);

  return new BullMqJobApplicationQueue({
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379),
  });
}
