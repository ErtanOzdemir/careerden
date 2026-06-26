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
} from "@link2cv/application";
import {
  AiProviderFactory,
  BullMqJobApplicationQueue,
  DocxtemplaterTemplateRenderer,
  HtmlTemplateRenderer,
  InMemoryJobApplicationChangeBus,
  PlaywrightPdfRenderer,
  PostgresJobApplicationRepository,
  PostgresUserProfileRepository,
  PublishingJobApplicationRepository,
  RustFsStorage,
  createPostgresDb,
  runPostgresMigrations,
} from "@link2cv/infrastructure";
import type { Knex } from "knex";
import { createAuth } from "./auth/auth.js";
import { requireSession } from "./auth/session.middleware.js";
import type { AuthenticatedUser } from "./auth/session.middleware.js";
import type { ApiEnv } from "./env.js";
import { createJobApplicationRouter } from "./job-applications/job-applications.routes.js";
import { createProfileRouter } from "./profiles/profiles.routes.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createAnalyzeScrapedJobWorker } from "./job-applications/analyze-scraped-job.worker.js";

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
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.WEB_ORIGIN, env.BETTER_AUTH_URL],
  });
  const changeBus = new InMemoryJobApplicationChangeBus();
  const innerJobApplications = new PostgresJobApplicationRepository(db);
  const jobApplications = new PublishingJobApplicationRepository(innerJobApplications, changeBus);
  const profiles = new PostgresUserProfileRepository(db);
  const queue = BullMqJobApplicationQueue.create(env.REDIS_URL);
  const storage = new RustFsStorage({
    accessKeyId: env.RUSTFS_ACCESS_KEY_ID,
    bucket: env.RUSTFS_BUCKET,
    endpoint: env.RUSTFS_ENDPOINT,
    forcePathStyle: env.RUSTFS_FORCE_PATH_STYLE,
    region: env.RUSTFS_REGION,
    secretAccessKey: env.RUSTFS_SECRET_ACCESS_KEY,
  });
  const docxTemplates = new DocxtemplaterTemplateRenderer();
  const generateDocumentsUseCase = new GenerateDocumentsUseCase(
    new HtmlTemplateRenderer(),
    new PlaywrightPdfRenderer(),
    storage,
    jobApplications,
    profiles,
    docxTemplates,
  );
  const aiProviderFactory = new AiProviderFactory({
    aiProvider: env.AI_PROVIDER,
    openaiApiKey: env.OPENAI_API_KEY,
    geminiApiKey: env.GEMINI_API_KEY,
    deepseekApiKey: env.DEEPSEEK_API_KEY,
  });
  const worker = createAnalyzeScrapedJobWorker({
    aiProviderFactory,
    jobApplications,
    profiles,
    redisUrl: env.REDIS_URL,
  });

  async function getProfileForUser(user: AuthenticatedUser) {
    const existing = await profiles.findByUserId(user.id);

    if (existing) {
      return existing;
    }

    return profiles.createForUserId(user.id, {
      fullName: user.name || user.email,
      email: user.email,
      skills: [],
      experience: [],
      links: [],
      education: [],
      certifications: [],
      projects: [],
    });
  }

  async function canAccessProfile(profileId: string, userId: string): Promise<boolean> {
    return (await profiles.findUserIdByProfileId(profileId)) === userId;
  }

  async function canAccessJobApplication(
    jobApplicationId: string,
    userId: string,
  ): Promise<boolean> {
    const jobApplication = await jobApplications.findById(jobApplicationId);

    if (!jobApplication) {
      return false;
    }

    return canAccessProfile(jobApplication.profileId, userId);
  }

  const app = express();

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
      updateProfile: new UpdateProfileUseCase(profiles),
      profiles,
      storage,
      docxTemplates,
      getProfileForUser,
      canAccessProfile,
    }),
  );
  app.use(
    "/job-applications",
    createJobApplicationRouter({
      submitJobApplication: new SubmitJobApplicationUseCase(jobApplications, profiles),
      deleteJobApplication: new DeleteJobApplicationUseCase(jobApplications, storage),
      generateJobApplicationDocuments: new GenerateJobApplicationDocumentsUseCase(
        jobApplications,
        profiles,
        generateDocumentsUseCase,
      ),
      retryJobApplication: new RetryJobApplicationUseCase(jobApplications, queue, storage),
      updateDocumentContent: new UpdateDocumentContentUseCase(jobApplications),
      jobApplications,
      jobApplicationChanges: changeBus,
      queue,
      storage,
      getProfileForUser,
      canAccessProfile,
      canAccessJobApplication,
    }),
  );
  app.use(errorHandler);

  return {
    app,
    db,
    close: async () => {
      await worker.close();
      await queue.close();
      await db.destroy();
    },
  };
}
