import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express from "express";
import type { Express } from "express";
import {
  CreateProfileUseCase,
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
  JobApplicationChangeNotifier,
} from "@link2cv/application";
import {
  BullMqFollowUpReminderQueue,
  DocxtemplaterTemplateRenderer,
  HtmlTemplateRenderer,
  HttpRemoteImageFetcher,
  PlaywrightPdfRenderer,
  PostgresFollowUpReminderRepository,
  PostgresJobApplicationRepository,
  PostgresNotificationRepository,
  PostgresPersistenceUnitOfWork,
  PostgresUserProfileRepository,
  RedisJobApplicationChangeBus,
  RustFsStorage,
  createPostgresDb,
  runPostgresMigrations,
} from "@link2cv/infrastructure";
import type { Knex } from "knex";
import { createAuth } from "./auth/auth.js";
import { requireSession } from "./auth/session.middleware.js";
import { createSmtpOtpEmailSender } from "./auth/email-otp-mailer.js";
import type { ApiEnv } from "./env.js";
import { createJobApplicationRouter } from "./job-applications/job-applications.routes.js";
import { errorHandler } from "./middleware/error-handler.js";
import { traceIdMiddleware } from "./middleware/trace-id.middleware.js";
import { createNotificationRouter } from "./notifications/notifications.routes.js";
import { createProfileRouter } from "./profiles/profiles.routes.js";

export interface ApiRuntime {
  app: Express;
  db: Knex;
  close: () => Promise<void>;
}

export async function createApiRuntime(env: ApiEnv): Promise<ApiRuntime> {
  const db = createPostgresDb(env.DATABASE_URL);
  await runPostgresMigrations(db);

  const auth = createAuth({
    baseUrl: env.BETTER_AUTH_URL,
    databaseUrl: env.DATABASE_URL,
    otpEmailSender: createSmtpOtpEmailSender({
      from: env.SMTP_FROM,
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
    }),
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.WEB_ORIGIN, env.BETTER_AUTH_URL],
  });
  const changeBus = RedisJobApplicationChangeBus.create(env.REDIS_URL);
  const jobApplications = new PostgresJobApplicationRepository(db);
  const jobApplicationChanges = new JobApplicationChangeNotifier(changeBus);
  const notifications = new PostgresNotificationRepository(db);
  const followUpReminders = new PostgresFollowUpReminderRepository(db);
  const profiles = new PostgresUserProfileRepository(db);
  const unitOfWork = new PostgresPersistenceUnitOfWork(db);
  const followUpReminderQueue = BullMqFollowUpReminderQueue.create(env.REDIS_URL);
  const storage = new RustFsStorage({
    accessKeyId: env.RUSTFS_ACCESS_KEY_ID,
    bucket: env.RUSTFS_BUCKET,
    endpoint: env.RUSTFS_ENDPOINT,
    forcePathStyle: env.RUSTFS_FORCE_PATH_STYLE,
    region: env.RUSTFS_REGION,
    secretAccessKey: env.RUSTFS_SECRET_ACCESS_KEY,
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
  );
  const getCurrentProfile = new GetOrCreateCurrentProfileUseCase(profiles);
  const getProfile = new GetProfileUseCase(profiles);
  const getJobApplicationDetail = new GetJobApplicationDetailUseCase(
    jobApplications,
    profiles,
    storage,
  );

  const app = express();

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
      uploadDocumentTemplate: new UploadDocumentTemplateUseCase(
        profiles,
        storage,
        docxTemplates,
        unitOfWork,
      ),
      updateDocumentTemplateMappings: new UpdateDocumentTemplateMappingsUseCase(profiles),
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
      updateDocumentContent: new UpdateDocumentContentUseCase(
        jobApplications,
        profiles,
        jobApplicationChanges,
      ),
      ensureJobApplicationAccess: new EnsureJobApplicationAccessUseCase(jobApplications, profiles),
      updateJobApplicationStatus: new UpdateJobApplicationStatusUseCase(
        jobApplications,
        profiles,
        jobApplicationChanges,
      ),
      listJobApplications: new ListJobApplicationsUseCase(jobApplications, profiles, storage),
      getJobApplicationAnalytics: new GetJobApplicationAnalyticsUseCase(jobApplications, profiles),
      getJobApplicationDetail,
      updateJobApplicationTracking: new UpdateJobApplicationTrackingUseCase(
        jobApplications,
        profiles,
        jobApplicationChanges,
      ),
      requestJobApplicationAnalysis: new RequestJobApplicationAnalysisUseCase(unitOfWork),
      claimNextScrapeJob: new ClaimNextScrapeJobUseCase(getCurrentProfile, unitOfWork),
      createJobApplicationFromScrape: new CreateJobApplicationFromScrapeUseCase(
        getCurrentProfile,
        unitOfWork,
      ),
      renewScrapeClaim: new RenewScrapeClaimUseCase(
        jobApplications,
        profiles,
        jobApplicationChanges,
      ),
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
      createJobApplicationEvent: new CreateJobApplicationEventUseCase(
        jobApplications,
        profiles,
        jobApplicationChanges,
      ),
      listJobApplicationEvents: new ListJobApplicationEventsUseCase(jobApplications, profiles),
      createJobApplicationContact: new CreateJobApplicationContactUseCase(
        jobApplications,
        profiles,
        jobApplicationChanges,
      ),
      listJobApplicationContacts: new ListJobApplicationContactsUseCase(jobApplications, profiles),
      updateJobApplicationContact: new UpdateJobApplicationContactUseCase(
        jobApplications,
        profiles,
        jobApplicationChanges,
      ),
      deleteJobApplicationContact: new DeleteJobApplicationContactUseCase(
        jobApplications,
        profiles,
        jobApplicationChanges,
      ),
      createJobApplicationFollowUp: new CreateJobApplicationFollowUpUseCase(
        jobApplications,
        profiles,
        followUpReminderQueue,
        followUpReminders,
        jobApplicationChanges,
      ),
      listJobApplicationFollowUps: new ListJobApplicationFollowUpsUseCase(
        jobApplications,
        profiles,
      ),
      updateJobApplicationFollowUp: new UpdateJobApplicationFollowUpUseCase(
        jobApplications,
        profiles,
        followUpReminderQueue,
        followUpReminders,
        jobApplicationChanges,
      ),
      deleteJobApplicationFollowUp: new DeleteJobApplicationFollowUpUseCase(
        jobApplications,
        profiles,
        followUpReminderQueue,
        jobApplicationChanges,
      ),
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
    }),
  );
  app.use(errorHandler);

  return {
    app,
    db,
    close: async () => {
      await followUpReminderQueue.close();
      await changeBus.close();
      await db.destroy();
    },
  };
}
