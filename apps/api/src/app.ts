import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express from "express";
import type { Express } from "express";
import { CreateProfileUseCase } from "./application/profiles/create-profile.use-case.js";
import { CreateManualJobApplicationUseCase } from "./application/job-applications/create-manual-job-application.use-case.js";
import { ArchiveJobApplicationUseCase } from "./application/job-applications/archive-job-application.use-case.js";
import { RestoreJobApplicationUseCase } from "./application/job-applications/restore-job-application.use-case.js";
import { DeleteJobApplicationUseCase } from "./application/job-applications/delete-job-application.use-case.js";
import {
  GenerateDocumentsUseCase,
  RequestApplicationPackGenerationUseCase,
} from "@careerden/application";
import { GenerateJobApplicationDocumentsUseCase } from "./application/job-applications/generate-job-application-documents.use-case.js";
import { RetryJobApplicationUseCase } from "./application/job-applications/retry-job-application.use-case.js";
import { SubmitJobApplicationUseCase } from "./application/job-applications/submit-job-application.use-case.js";
import { UpdateDocumentContentUseCase } from "./application/job-applications/update-document-content.use-case.js";
import { UpdateProfileUseCase } from "./application/profiles/update-profile.use-case.js";
import { GetOrCreateCurrentProfileUseCase } from "./application/profiles/get-or-create-current-profile.use-case.js";
import { GetProfileUseCase } from "./application/profiles/get-profile.use-case.js";
import { PreviewApplicationPackUseCase } from "./application/job-applications/preview-application-pack.use-case.js";
import { ApplyDocumentFieldTipUseCase } from "./application/job-applications/apply-document-field-tip.use-case.js";
import { RewriteCoverLetterUseCase } from "./application/job-applications/rewrite-cover-letter.use-case.js";
import { CountUnreadNotificationsUseCase } from "./application/notifications/count-unread-notifications.use-case.js";
import { ListNotificationsUseCase } from "./application/notifications/list-notifications.use-case.js";
import { MarkAllNotificationsReadUseCase } from "./application/notifications/mark-all-notifications-read.use-case.js";
import { MarkNotificationReadUseCase } from "./application/notifications/mark-notification-read.use-case.js";
import { EnsureJobApplicationAccessUseCase } from "./application/job-applications/ensure-job-application-access.use-case.js";
import { GetJobApplicationAnalyticsUseCase } from "./application/job-applications/get-job-application-analytics.use-case.js";
import { GetJobApplicationDetailUseCase } from "./application/job-applications/get-job-application-detail.use-case.js";
import { ListJobApplicationsUseCase } from "./application/job-applications/list-job-applications.use-case.js";
import { RequestJobApplicationAnalysisUseCase } from "./application/job-applications/request-job-application-analysis.use-case.js";
import { UpdateJobApplicationStatusUseCase } from "./application/job-applications/update-job-application-status.use-case.js";
import { UpdateJobApplicationTrackingUseCase } from "./application/job-applications/update-job-application-tracking.use-case.js";
import { ClaimNextScrapeJobUseCase } from "./application/job-applications/claim-next-scrape-job.use-case.js";
import { CreateJobApplicationFromScrapeUseCase } from "./application/job-applications/create-job-application-from-scrape.use-case.js";
import { FailScrapeJobUseCase } from "./application/job-applications/fail-scrape-job.use-case.js";
import { RenewScrapeClaimUseCase } from "./application/job-applications/renew-scrape-claim.use-case.js";
import { SubmitJobApplicationScrapeDataUseCase } from "./application/job-applications/submit-job-application-scrape-data.use-case.js";
import { CreateJobApplicationEventUseCase } from "./application/job-applications/create-job-application-event.use-case.js";
import { ListJobApplicationEventsUseCase } from "./application/job-applications/list-job-application-events.use-case.js";
import { CreateJobApplicationContactUseCase } from "./application/job-applications/create-job-application-contact.use-case.js";
import { ListJobApplicationContactsUseCase } from "./application/job-applications/list-job-application-contacts.use-case.js";
import { UpdateJobApplicationContactUseCase } from "./application/job-applications/update-job-application-contact.use-case.js";
import { DeleteJobApplicationContactUseCase } from "./application/job-applications/delete-job-application-contact.use-case.js";
import { CreateJobApplicationFollowUpUseCase } from "./application/job-applications/create-job-application-follow-up.use-case.js";
import { ListJobApplicationFollowUpsUseCase } from "./application/job-applications/list-job-application-follow-ups.use-case.js";
import { UpdateJobApplicationFollowUpUseCase } from "./application/job-applications/update-job-application-follow-up.use-case.js";
import { DeleteJobApplicationFollowUpUseCase } from "./application/job-applications/delete-job-application-follow-up.use-case.js";
import { GetGeneratedDocumentDownloadUrlUseCase } from "./application/job-applications/get-generated-document-download-url.use-case.js";
import { SubmitSupportRequestUseCase } from "./application/support/submit-support-request.use-case.js";
import { EnsureCurrentMonthlyCreditsUseCase } from "./application/billing/ensure-current-monthly-credits.use-case.js";
import { GetCreditBalanceUseCase } from "./application/billing/get-credit-balance.use-case.js";
import { CreateBillingPortalUseCase } from "./application/billing/create-billing-portal.use-case.js";
import { CreateSubscriptionCheckoutUseCase } from "./application/billing/create-subscription-checkout.use-case.js";
import { GetBillingSubscriptionUseCase } from "./application/billing/get-billing-subscription.use-case.js";
import { ListBillingPaymentsUseCase } from "./application/billing/list-billing-payments.use-case.js";
import { ListCreditActivityUseCase } from "./application/billing/list-credit-activity.use-case.js";
import { KnexCreditActivityReader } from "./infrastructure/billing/knex-credit-activity.reader.js";
import { ProcessBillingProviderEventUseCase } from "./application/billing/process-billing-provider-event.use-case.js";
import {
  AiProviderFactory,
  HtmlTemplateRenderer,
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
  PostgresBillingSubscriptionRepository,
  createResendEmailSender,
} from "@careerden/infrastructure";
import { aiProviderConfigFromEnv } from "@careerden/config";
import { HttpRemoteImageFetcher } from "./infrastructure/scraping/http-remote-image.fetcher.js";
import { MockSupportRequestNotifier } from "./infrastructure/support/mock-support-request.notifier.js";
import { CreemSubscriptionBillingProvider } from "./infrastructure/billing/creem-subscription-billing.provider.js";
import { CreemWebhookEventParser } from "./infrastructure/billing/creem-webhook-event.parser.js";
import type { AiProvider } from "@careerden/domain";
import type { Knex } from "knex";
import { createAuth } from "./auth/auth.js";
import { requireSession } from "./auth/session.middleware.js";
import { createBillingRouter } from "./billing/billing.routes.js";
import { createCreemWebhookRouter } from "./billing/creem-webhook.routes.js";
import { isCreemConfigured } from "./env.js";
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

  const changeBus = RedisJobApplicationChangeBus.create(env.REDIS_URL);
  const notificationChangeBus = RedisNotificationChangeBus.create(env.REDIS_URL);
  const jobApplications = new PostgresJobApplicationRepository(db);
  const notifications = new PostgresNotificationRepository(db);
  const profiles = new PostgresUserProfileRepository(db);
  const unitOfWork = new PostgresPersistenceUnitOfWork(db, changeBus);
  const ensureCurrentMonthlyCredits = new EnsureCurrentMonthlyCreditsUseCase(unitOfWork);
  const getCreditBalance = new GetCreditBalanceUseCase(unitOfWork);
  const billingSubscriptions = new PostgresBillingSubscriptionRepository(db);
  const getBillingSubscription = new GetBillingSubscriptionUseCase(billingSubscriptions);
  const listCreditActivity = new ListCreditActivityUseCase(new KnexCreditActivityReader(db));
  const creem = isCreemConfigured(env)
    ? (() => {
        const provider = new CreemSubscriptionBillingProvider({
          apiKey: env.CREEM_API_KEY,
          productId: env.CREEM_PRODUCT_ID,
          planKey: env.CREEM_PLAN_KEY,
          successUrl: env.CREEM_SUCCESS_URL ?? `${env.WEB_ORIGIN}/billing?checkout=success`,
          testMode: env.CREEM_TEST_MODE,
        });
        return {
          createCheckout: new CreateSubscriptionCheckoutUseCase(provider),
          createPortal: new CreateBillingPortalUseCase(billingSubscriptions, provider),
          listPayments: new ListBillingPaymentsUseCase(billingSubscriptions, provider),
          parser: new CreemWebhookEventParser({
            webhookSecret: env.CREEM_WEBHOOK_SECRET,
            productId: env.CREEM_PRODUCT_ID,
            planKey: env.CREEM_PLAN_KEY,
          }),
          processEvent: new ProcessBillingProviderEventUseCase(unitOfWork),
        };
      })()
    : undefined;
  const auth = createAuth({
    emailSender:
      env.NODE_ENV === "production"
        ? createResendEmailSender({
            apiKey: env.RESEND_API_KEY,
            from: env.EMAIL_FROM,
          })
        : createSmtpEmailSender({
            from: env.EMAIL_FROM,
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
          }),
    creditProvisioner: ensureCurrentMonthlyCredits,
    baseUrl: env.BETTER_AUTH_URL,
    databaseUrl: env.DATABASE_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.WEB_ORIGIN, env.BETTER_AUTH_URL],
    rateLimitEnabled: env.AUTH_RATE_LIMIT_ENABLED,
    trustedProxies: env.AUTH_TRUSTED_PROXIES,
  });
  const storage = new S3CompatibleStorage({
    accessKeyId: env.OBJECT_STORAGE_ACCESS_KEY_ID,
    bucket: env.OBJECT_STORAGE_BUCKET,
    endpoint: env.OBJECT_STORAGE_ENDPOINT,
    forcePathStyle: env.OBJECT_STORAGE_FORCE_PATH_STYLE,
    region: env.OBJECT_STORAGE_REGION,
    secretAccessKey: env.OBJECT_STORAGE_SECRET_ACCESS_KEY,
  });
  const remoteImageFetcher = new HttpRemoteImageFetcher();
  // Optional: this API process has no other hard dependency on an AI provider (analysis itself runs
  // in apps/llm-worker), so a missing key here disables just the apply-tip route rather than
  // failing the whole server to boot — same "absent means disabled" pattern as `generateWithAi`
  // below.
  let aiProvider: AiProvider | undefined;
  try {
    aiProvider = new AiProviderFactory(aiProviderConfigFromEnv(env)).create();
  } catch {
    aiProvider = undefined;
  }
  const generateDocumentsUseCase = new GenerateDocumentsUseCase(
    new HtmlTemplateRenderer(),
    new PlaywrightPdfRenderer(),
    storage,
    jobApplications,
    profiles,
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
  if (creem) {
    app.use(
      "/billing/webhooks/creem",
      createCreemWebhookRouter({
        parser: creem.parser,
        processEvent: creem.processEvent,
      }),
    );
  }
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.use(requireSession(auth));
  app.use(
    "/billing",
    createBillingRouter({
      getCreditBalance,
      getBillingSubscription,
      listCreditActivity,
      ...(creem
        ? {
            createCheckout: creem.createCheckout,
            createPortal: creem.createPortal,
            listPayments: creem.listPayments,
          }
        : {}),
    }),
  );
  app.use(
    "/profiles",
    createProfileRouter({
      createProfile: new CreateProfileUseCase(profiles),
      getCurrentProfile,
      getProfile,
      updateProfile: new UpdateProfileUseCase(profiles),
    }),
  );
  app.use(
    "/job-applications",
    createJobApplicationRouter({
      createManualJobApplication: new CreateManualJobApplicationUseCase(
        profiles,
        storage,
        unitOfWork,
      ),
      submitJobApplication: new SubmitJobApplicationUseCase(unitOfWork),
      archiveJobApplication: new ArchiveJobApplicationUseCase(unitOfWork),
      restoreJobApplication: new RestoreJobApplicationUseCase(unitOfWork),
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
      previewApplicationPack: new PreviewApplicationPackUseCase(
        jobApplications,
        profiles,
        generateDocumentsUseCase,
      ),
      ...(aiProvider
        ? {
            applyDocumentFieldTip: new ApplyDocumentFieldTipUseCase(
              jobApplications,
              profiles,
              aiProvider,
              billingSubscriptions,
            ),
            rewriteCoverLetter: new RewriteCoverLetterUseCase(
              jobApplications,
              profiles,
              aiProvider,
              billingSubscriptions,
            ),
          }
        : {}),
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
