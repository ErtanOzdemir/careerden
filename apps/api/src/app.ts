import { toNodeHandler } from "better-auth/node";
import type { Express } from "express";
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
import { HttpRemoteImageFetcher } from "./infrastructure/scraping/http-remote-image.fetcher.js";
import { MockSupportRequestNotifier } from "./infrastructure/support/mock-support-request.notifier.js";
import { CreemSubscriptionBillingProvider } from "./infrastructure/billing/creem-subscription-billing.provider.js";
import { CreemWebhookEventParser } from "./infrastructure/billing/creem-webhook-event.parser.js";
import type { AiProvider } from "@careerden/domain";
import type { Knex } from "knex";
import { createAuth } from "./auth/auth.js";
import { requireSession } from "./auth/session.middleware.js";
import { createCreemWebhookRouter } from "./billing/creem-webhook.routes.js";
import { isCreemConfigured } from "./env.js";
import type { ApiEnv } from "./env.js";
import { createApiApp } from "./api-app.js";

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
  // Optional: this API process has no other hard dependency on an AI provider (analysis itself runs
  // in apps/llm-worker), so a missing key here disables just the apply-tip route rather than
  // failing the whole server to boot — same "absent means disabled" pattern as `generateWithAi`
  // below.
  let aiProvider: AiProvider | undefined;
  try {
    aiProvider = new AiProviderFactory({
      aiProvider: env.AI_PROVIDER,
      openaiApiKey: env.OPENAI_API_KEY,
      geminiApiKey: env.GEMINI_API_KEY,
      deepseekApiKey: env.DEEPSEEK_API_KEY,
      anthropicApiKey: env.ANTHROPIC_API_KEY,
      openrouterApiKey: env.OPENROUTER_API_KEY,
    }).create();
  } catch {
    aiProvider = undefined;
  }
  const app = createApiApp({
    jobApplications,
    notifications,
    profiles,
    unitOfWork,
    storage,
    pdfRenderer: new PlaywrightPdfRenderer(),
    remoteImageFetcher: new HttpRemoteImageFetcher(),
    jobApplicationChanges: changeBus,
    notificationChanges: notificationChangeBus,
    ...(aiProvider ? { aiProvider } : {}),
    http: {
      enableHsts: env.NODE_ENV === "production",
      corsOrigin: env.WEB_ORIGIN,
      mountRawRoutes: (rawApp) => {
        rawApp.all("/auth/*", toNodeHandler(auth));
        if (creem) {
          rawApp.use(
            "/billing/webhooks/creem",
            createCreemWebhookRouter({
              parser: creem.parser,
              processEvent: creem.processEvent,
            }),
          );
        }
      },
      authenticate: requireSession(auth),
    },
    billing: {
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
    },
    supportRequestNotifier: new MockSupportRequestNotifier(),
  });

  return {
    app,
    db,
    close: async () => {
      await Promise.all([changeBus.close(), notificationChangeBus.close()]);
      await db.destroy();
    },
  };
}
