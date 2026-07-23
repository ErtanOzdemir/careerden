import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express from "express";
import type { Express } from "express";
import {
  CreateProfileUseCase,
  DeleteDocumentTemplateUseCase,
  DeleteJobApplicationUseCase,
  GenerateDocumentsUseCase,
  GenerateJobApplicationDocumentsUseCase,
  RetryJobApplicationUseCase,
  SubmitJobApplicationUseCase,
  UpdateDocumentContentUseCase,
  UpdateProfileUseCase,
  GetOrCreateCurrentProfileUseCase,
  GetProfileUseCase,
  ListDocumentTemplatesUseCase,
  SetDefaultDocumentTemplateUseCase,
  UpdateDocumentTemplateMappingsUseCase,
  UpdateDocumentTemplateVariableAliasesUseCase,
  UploadDocumentTemplateUseCase,
  CountUnreadNotificationsUseCase,
  ListNotificationsUseCase,
  MarkAllNotificationsReadUseCase,
  MarkNotificationReadUseCase,
  EnsureJobApplicationAccessUseCase,
  GetJobApplicationAnalyticsUseCase,
  GetJobApplicationDetailUseCase,
  ListJobApplicationsUseCase,
  RequestJobApplicationAnalysisUseCase,
  RequestApplicationPackGenerationUseCase,
  UpdateJobApplicationStatusUseCase,
  UpdateJobApplicationTrackingUseCase,
  ClaimNextScrapeJobUseCase,
  CreateJobApplicationFromScrapeUseCase,
  FailScrapeJobUseCase,
  RenewScrapeClaimUseCase,
  SubmitJobApplicationScrapeDataUseCase,
  CreateJobApplicationEventUseCase,
  ListJobApplicationEventsUseCase,
  CreateJobApplicationContactUseCase,
  ListJobApplicationContactsUseCase,
  UpdateJobApplicationContactUseCase,
  DeleteJobApplicationContactUseCase,
  CreateJobApplicationFollowUpUseCase,
  ListJobApplicationFollowUpsUseCase,
  UpdateJobApplicationFollowUpUseCase,
  DeleteJobApplicationFollowUpUseCase,
  GetGeneratedDocumentDownloadUrlUseCase,
  SubmitSupportRequestUseCase,
} from "@careerden/application";
import {
  DocxtemplaterTemplateRenderer,
  GotenbergDocxPdfRenderer,
  HtmlTemplateRenderer,
  HttpRemoteImageFetcher,
  PlaywrightPdfRenderer,
  PostgresJobApplicationRepository,
  PostgresNotificationRepository,
  PostgresPersistenceUnitOfWork,
  PostgresUserProfileRepository,
  RedisJobApplicationChangeBus,
  RedisNotificationChangeBus,
  S3CompatibleStorage,
  createSmtpEmailSender,
  createPostgresDb,
  runPostgresMigrations,
  MockSupportRequestNotifier,
} from "@careerden/infrastructure";
import type { Knex } from "knex";
import { createAuth } from "./auth/auth.js";
import { requireSession } from "./auth/session.middleware.js";
import type { ApiEnv } from "./env.js";
import { createJobApplicationRouter } from "./job-applications/job-applications.routes.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createSecurityHeadersMiddleware } from "./middleware/security-headers.middleware.js";
import { traceIdMiddleware } from "./middleware/trace-id.middleware.js";
import { createNotificationRouter } from "./notifications/notifications.routes.js";
import { createProfileRouter } from "./profiles/profiles.routes.js";
import { createSupportRouter } from "./support/support.routes.js";

export interface ApiRuntime {
  app: Express;
  db: Knex;
  close: () => Promise<void>;
}

export async function createApiRuntime(env: ApiEnv): Promise<ApiRuntime> {
  const db = createPostgresDb(env.DATABASE_URL);
  await runPostgresMigrations(db);

  const auth = createAuth({
    emailSender: createSmtpEmailSender({
      from: env.SMTP_FROM,
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
    }),
    baseUrl: env.BETTER_AUTH_URL,
    databaseUrl: env.DATABASE_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.WEB_ORIGIN, env.BETTER_AUTH_URL],
  });
  const changeBus = RedisJobApplicationChangeBus.create(env.REDIS_URL);
  const notificationChangeBus = RedisNotificationChangeBus.create(env.REDIS_URL);
  const jobApplications = new PostgresJobApplicationRepository(db);
  const notifications = new PostgresNotificationRepository(db);
  const profiles = new PostgresUserProfileRepository(db);
  const unitOfWork = new PostgresPersistenceUnitOfWork(db, changeBus);
  const storage = new S3CompatibleStorage({
    accessKeyId: env.OBJECT_STORAGE_ACCESS_KEY_ID,
    bucket: env.OBJECT_STORAGE_BUCKET,
    endpoint: env.OBJECT_STORAGE_ENDPOINT,
    forcePathStyle: env.OBJECT_STORAGE_FORCE_PATH_STYLE,
    region: env.OBJECT_STORAGE_REGION,
    secretAccessKey: env.OBJECT_STORAGE_SECRET_ACCESS_KEY,
  });
  const remoteImageFetcher = new HttpRemoteImageFetcher();
  const docxTemplates = new DocxtemplaterTemplateRenderer();
  const generateDocumentsUseCase = new GenerateDocumentsUseCase(
    new HtmlTemplateRenderer(),
    new PlaywrightPdfRenderer(),
    storage,
    jobApplications,
    profiles,
    docxTemplates,
    new GotenbergDocxPdfRenderer({ baseUrl: env.GOTENBERG_URL }),
  );
  const getCurrentProfile = new GetOrCreateCurrentProfileUseCase(profiles);
  const getProfile = new GetProfileUseCase(profiles);
  const getJobApplicationDetail = new GetJobApplicationDetailUseCase(
    jobApplications,
    profiles,
    storage,
  );

  const app = express();

  app.use(createSecurityHeadersMiddleware({ enableHsts: env.NODE_ENV === "production" }));
  app.use(traceIdMiddleware);
  app.use(
    cors({
      credentials: true,
      origin: env.WEB_ORIGIN,
    }),
  );
  app.all("/auth/*", toNodeHandler(auth));
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.use(requireSession(auth));
  app.use(
    "/profiles",
    createProfileRouter({
      createProfile: new CreateProfileUseCase(profiles),
      getCurrentProfile,
      getProfile,
      updateProfile: new UpdateProfileUseCase(profiles),
      listDocumentTemplates: new ListDocumentTemplatesUseCase(profiles),
      deleteDocumentTemplate: new DeleteDocumentTemplateUseCase(unitOfWork),
      uploadDocumentTemplate: new UploadDocumentTemplateUseCase(
        profiles,
        storage,
        docxTemplates,
        unitOfWork,
      ),
      updateDocumentTemplateMappings: new UpdateDocumentTemplateMappingsUseCase(
        profiles,
        storage,
        docxTemplates,
      ),
      updateDocumentTemplateVariableAliases: new UpdateDocumentTemplateVariableAliasesUseCase(
        profiles,
      ),
      setDefaultDocumentTemplate: new SetDefaultDocumentTemplateUseCase(profiles),
    }),
  );
  app.use(
    "/job-applications",
    createJobApplicationRouter({
      submitJobApplication: new SubmitJobApplicationUseCase(unitOfWork),
      deleteJobApplication: new DeleteJobApplicationUseCase(unitOfWork),
      generateJobApplicationDocuments: new GenerateJobApplicationDocumentsUseCase(
        jobApplications,
        profiles,
        generateDocumentsUseCase,
        unitOfWork,
      ),
      retryJobApplication: new RetryJobApplicationUseCase(unitOfWork),
      updateDocumentContent: new UpdateDocumentContentUseCase(unitOfWork),
      ensureJobApplicationAccess: new EnsureJobApplicationAccessUseCase(jobApplications, profiles),
      updateJobApplicationStatus: new UpdateJobApplicationStatusUseCase(unitOfWork),
      listJobApplications: new ListJobApplicationsUseCase(jobApplications, profiles, storage),
      getJobApplicationAnalytics: new GetJobApplicationAnalyticsUseCase(jobApplications, profiles),
      getJobApplicationDetail,
      updateJobApplicationTracking: new UpdateJobApplicationTrackingUseCase(unitOfWork),
      requestJobApplicationAnalysis: new RequestJobApplicationAnalysisUseCase(unitOfWork),
      requestApplicationPackGeneration: new RequestApplicationPackGenerationUseCase(unitOfWork),
      claimNextScrapeJob: new ClaimNextScrapeJobUseCase(getCurrentProfile, unitOfWork),
      createJobApplicationFromScrape: new CreateJobApplicationFromScrapeUseCase(
        getCurrentProfile,
        unitOfWork,
      ),
      renewScrapeClaim: new RenewScrapeClaimUseCase(unitOfWork),
      failScrapeJob: new FailScrapeJobUseCase(unitOfWork),
      submitJobApplicationScrapeData: new SubmitJobApplicationScrapeDataUseCase(
        jobApplications,
        profiles,
        unitOfWork,
        remoteImageFetcher,
        storage,
        getJobApplicationDetail,
      ),
      getProfile,
      jobApplicationChanges: changeBus,
      createJobApplicationEvent: new CreateJobApplicationEventUseCase(unitOfWork),
      listJobApplicationEvents: new ListJobApplicationEventsUseCase(jobApplications, profiles),
      createJobApplicationContact: new CreateJobApplicationContactUseCase(unitOfWork),
      listJobApplicationContacts: new ListJobApplicationContactsUseCase(jobApplications, profiles),
      updateJobApplicationContact: new UpdateJobApplicationContactUseCase(unitOfWork),
      deleteJobApplicationContact: new DeleteJobApplicationContactUseCase(unitOfWork),
      createJobApplicationFollowUp: new CreateJobApplicationFollowUpUseCase(unitOfWork),
      listJobApplicationFollowUps: new ListJobApplicationFollowUpsUseCase(
        jobApplications,
        profiles,
      ),
      updateJobApplicationFollowUp: new UpdateJobApplicationFollowUpUseCase(unitOfWork),
      deleteJobApplicationFollowUp: new DeleteJobApplicationFollowUpUseCase(unitOfWork),
      getGeneratedDocumentDownloadUrl: new GetGeneratedDocumentDownloadUrlUseCase(
        jobApplications,
        profiles,
        storage,
      ),
    }),
  );
  app.use(
    "/notifications",
    createNotificationRouter({
      listNotifications: new ListNotificationsUseCase(notifications, getCurrentProfile),
      countUnreadNotifications: new CountUnreadNotificationsUseCase(
        notifications,
        getCurrentProfile,
      ),
      markNotificationRead: new MarkNotificationReadUseCase(notifications, getCurrentProfile),
      markAllNotificationsRead: new MarkAllNotificationsReadUseCase(
        notifications,
        getCurrentProfile,
      ),
      getCurrentProfile,
      notificationChanges: notificationChangeBus,
    }),
  );
  app.use(
    "/support",
    createSupportRouter({
      submitSupportRequest: new SubmitSupportRequestUseCase(new MockSupportRequestNotifier()),
    }),
  );
  app.use(errorHandler);

  return {
    app,
    db,
    close: async () => {
      await Promise.all([changeBus.close(), notificationChangeBus.close()]);
      await db.destroy();
    },
  };
}
