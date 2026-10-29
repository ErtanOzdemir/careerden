import cors from "cors";
import express from "express";
import type { Express, RequestHandler } from "express";
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
import type {
  AiProvider,
  DocumentRenderer,
  FileStorage,
  JobApplicationChangeSubscriber,
  JobApplicationRepository,
  NotificationChangeSubscriber,
  NotificationRepository,
  PersistenceUnitOfWork,
  UserProfileAccountRepository,
} from "@careerden/domain";
import { HtmlTemplateRenderer } from "@careerden/infrastructure";
import type { AiAvailability } from "./domain/matching/ai-availability.js";
import type { RemoteImageFetcher } from "./domain/scraping/remote-image-fetcher.js";
import { createBillingRouter } from "./billing/billing.routes.js";
import { createJobApplicationRouter } from "./job-applications/job-applications.routes.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createSecurityHeadersMiddleware } from "./middleware/security-headers.middleware.js";
import { traceIdMiddleware } from "./middleware/trace-id.middleware.js";
import { createNotificationRouter } from "./notifications/notifications.routes.js";
import { createProfileRouter } from "./profiles/profiles.routes.js";
import { createSupportRouter } from "./support/support.routes.js";
import type { SupportRequestNotifier } from "./domain/support/support-request-notifier.js";

export interface ApiAppDependencies {
  jobApplications: JobApplicationRepository;
  notifications: NotificationRepository;
  profiles: UserProfileAccountRepository;
  unitOfWork: PersistenceUnitOfWork;
  storage: FileStorage;
  pdfRenderer: DocumentRenderer;
  remoteImageFetcher: RemoteImageFetcher;
  jobApplicationChanges: JobApplicationChangeSubscriber;
  notificationChanges: NotificationChangeSubscriber;
  // Absent disables the AI-backed document editing routes.
  aiProvider?: AiProvider;
  // Absent treats AI analysis as always available.
  aiAvailability?: AiAvailability;
  http: {
    enableHsts: boolean;
    corsOrigin?: string;
    // Mounted before JSON body parsing, for handlers that consume the raw request body.
    mountRawRoutes?: (app: Express) => void;
    authenticate: RequestHandler;
  };
  // Absent leaves the route group unmounted.
  billing?: Parameters<typeof createBillingRouter>[0];
  supportRequestNotifier?: SupportRequestNotifier;
}

export function createApiApp(dependencies: ApiAppDependencies): Express {
  const {
    jobApplications,
    notifications,
    profiles,
    unitOfWork,
    storage,
    remoteImageFetcher,
    aiProvider,
    aiAvailability,
  } = dependencies;
  const generateDocumentsUseCase = new GenerateDocumentsUseCase(
    new HtmlTemplateRenderer(),
    dependencies.pdfRenderer,
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

  app.use(createSecurityHeadersMiddleware({ enableHsts: dependencies.http.enableHsts }));
  app.use(traceIdMiddleware);
  if (dependencies.http.corsOrigin) {
    app.use(
      cors({
        credentials: true,
        origin: dependencies.http.corsOrigin,
      }),
    );
  }
  dependencies.http.mountRawRoutes?.(app);
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.use(dependencies.http.authenticate);
  if (dependencies.billing) {
    app.use("/billing", createBillingRouter(dependencies.billing));
  }
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
        aiAvailability,
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
      retryJobApplication: new RetryJobApplicationUseCase(unitOfWork, aiAvailability),
      updateDocumentContent: new UpdateDocumentContentUseCase(unitOfWork),
      ensureJobApplicationAccess: new EnsureJobApplicationAccessUseCase(jobApplications, profiles),
      updateJobApplicationStatus: new UpdateJobApplicationStatusUseCase(unitOfWork),
      listJobApplications: new ListJobApplicationsUseCase(jobApplications, profiles, storage),
      getJobApplicationAnalytics: new GetJobApplicationAnalyticsUseCase(jobApplications, profiles),
      getJobApplicationDetail,
      updateJobApplicationTracking: new UpdateJobApplicationTrackingUseCase(unitOfWork),
      requestJobApplicationAnalysis: new RequestJobApplicationAnalysisUseCase(
        unitOfWork,
        aiAvailability,
      ),
      requestApplicationPackGeneration: new RequestApplicationPackGenerationUseCase(unitOfWork),
      claimNextScrapeJob: new ClaimNextScrapeJobUseCase(getCurrentProfile, unitOfWork),
      createJobApplicationFromScrape: new CreateJobApplicationFromScrapeUseCase(
        getCurrentProfile,
        unitOfWork,
        aiAvailability,
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
        aiAvailability,
      ),
      getProfile,
      jobApplicationChanges: dependencies.jobApplicationChanges,
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
            ),
            rewriteCoverLetter: new RewriteCoverLetterUseCase(
              jobApplications,
              profiles,
              aiProvider,
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
      notificationChanges: dependencies.notificationChanges,
    }),
  );
  if (dependencies.supportRequestNotifier) {
    app.use(
      "/support",
      createSupportRouter({
        submitSupportRequest: new SubmitSupportRequestUseCase(dependencies.supportRequestNotifier),
      }),
    );
  }
  app.use(errorHandler);

  return app;
}
