import { app as electronApp } from "electron";
import type { Express } from "express";
import {
  CreateProfileUseCase,
  DeleteJobApplicationUseCase,
  GenerateDocumentsUseCase,
  GenerateDocumentsWithAiUseCase,
  GenerateJobApplicationDocumentsUseCase,
  ProcessJobApplicationUseCase,
  RetryJobApplicationUseCase,
  SubmitJobApplicationUseCase,
  UpdateDocumentContentUseCase,
  UpdateProfileUseCase,
} from "@link2cv/application";
import {
  CareerPageScraper,
  CompanyWebsiteScraper,
  DocxtemplaterTemplateRenderer,
  HttpRemoteImageFetcher,
  HtmlTemplateRenderer,
  InMemoryJobApplicationChangeBus,
  LinkedInCompanyScraper,
  LinkedInJobScraper,
  LinkedInSessionManager,
  LocalFileStorage,
  PlaywrightPdfRenderer,
  PublishingJobApplicationRepository,
  RemotePremiumAiService,
  SelfProcessingJobApplicationQueue,
  SqliteJobApplicationRepository,
  SqliteUserProfileRepository,
  createSqliteDb,
  runSqliteMigrations,
} from "@link2cv/infrastructure";
import type { Knex } from "knex";
import { join, resolve } from "node:path";
import {
  createJobApplicationRouter,
  createLinkedInSessionRouter,
  createProfileRouter,
  errorHandler,
} from "@link2cv/api";
import cors from "cors";
import express from "express";
import type { FileStorage, StoredFile, StoredFileContent, StoredFileInput } from "@link2cv/domain";

export interface DesktopServerOptions {
  premiumApiUrl?: string;
  premiumApiTokenProvider?: () => Promise<string | null>;
}

export interface DesktopServer {
  app: Express;
  port: number;
  defaultProfileId: string | undefined;
}

export async function startDesktopServer(
  options: DesktopServerOptions = {},
): Promise<DesktopServer> {
  const userDataPath = electronApp.getPath("userData");
  const dbPath = join(userDataPath, "link2cv.db");
  const storageDir = join(userDataPath, "storage");
  const sessionDir = join(userDataPath, "linkedin-session");

  const db: Knex = createSqliteDb(dbPath);
  await runSqliteMigrations(db);

  const changeBus = new InMemoryJobApplicationChangeBus();
  const jobApplications = new PublishingJobApplicationRepository(
    new SqliteJobApplicationRepository(db),
    changeBus,
  );
  const profiles = new SqliteUserProfileRepository(db);

  let defaultProfileId: string | undefined;
  const existingProfiles = await db("user_profiles").select("id").limit(1);
  if (existingProfiles.length > 0) {
    defaultProfileId = String(existingProfiles[0].id);
  } else {
    const created = await profiles.create({
      fullName: "My Profile",
      email: "",
      skills: [],
      experience: [],
    });
    defaultProfileId = created.id;
  }
  const storage = new DesktopFileStorage(new LocalFileStorage(storageDir), storageDir);
  const templates = new HtmlTemplateRenderer();
  const documents = new PlaywrightPdfRenderer();
  const docxTemplates = new DocxtemplaterTemplateRenderer();
  const linkedInSessionManager = new LinkedInSessionManager(
    sessionDir,
    "desktop-linkedin-session-secret",
  );

  const premiumAi =
    options.premiumApiUrl && options.premiumApiTokenProvider
      ? new RemotePremiumAiService({
          apiUrl: options.premiumApiUrl,
          tokenProvider: options.premiumApiTokenProvider,
        })
      : undefined;

  const scrapers = {
    job: new LinkedInJobScraper(linkedInSessionManager),
    companyLinkedIn: new LinkedInCompanyScraper(linkedInSessionManager),
    companyWebsite: new CompanyWebsiteScraper(),
    careerPage: new CareerPageScraper(),
  };

  const processor = new ProcessJobApplicationUseCase(
    jobApplications,
    profiles,
    scrapers,
    undefined,
    undefined,
    storage,
    new HttpRemoteImageFetcher(),
  );

  const queue = new SelfProcessingJobApplicationQueue(async (payload) => {
    await processor.execute(payload.jobApplicationId);
  });

  const generateDocumentsUseCase = new GenerateDocumentsUseCase(
    templates,
    documents,
    storage,
    jobApplications,
    profiles,
    docxTemplates,
  );

  const generateWithAi = premiumAi
    ? new GenerateDocumentsWithAiUseCase(
        premiumAi,
        generateDocumentsUseCase,
        jobApplications,
        profiles,
      )
    : undefined;

  const submitJobApplication = new SubmitJobApplicationUseCase(jobApplications, profiles, queue);
  const deleteJobApplication = new DeleteJobApplicationUseCase(jobApplications, storage);
  const retryJobApplication = new RetryJobApplicationUseCase(jobApplications, queue, storage);
  const updateDocumentContent = new UpdateDocumentContentUseCase(jobApplications);
  const generateJobApplicationDocuments = new GenerateJobApplicationDocumentsUseCase(
    jobApplications,
    profiles,
    generateDocumentsUseCase,
  );

  const expressApp = express();

  expressApp.use(cors());
  expressApp.use(express.json({ limit: "300kb" }));
  expressApp.use("/storage", express.static(resolve(storageDir)));

  expressApp.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  expressApp.use(
    "/profiles",
    createProfileRouter({
      createProfile: new CreateProfileUseCase(profiles),
      updateProfile: new UpdateProfileUseCase(profiles),
      profiles,
      storage,
      docxTemplates,
    }),
  );

  expressApp.use(
    "/job-applications",
    createJobApplicationRouter({
      submitJobApplication,
      deleteJobApplication,
      generateJobApplicationDocuments,
      retryJobApplication,
      updateDocumentContent,
      jobApplications,
      jobApplicationChanges: changeBus,
      storage,
      ...(generateWithAi ? { generateWithAi } : {}),
    }),
  );

  expressApp.use(
    "/linkedin-session",
    createLinkedInSessionRouter({
      linkedInSessionManager,
    }),
  );

  expressApp.use(errorHandler);

  return listenOnAvailablePort(expressApp, defaultProfileId, storage);
}

function listenOnAvailablePort(
  app: Express,
  defaultProfileId: string | undefined,
  storage: DesktopFileStorage,
): Promise<DesktopServer> {
  return new Promise((resolvePromise) => {
    const server = app.listen(0, () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 3000;
      storage.setPort(port);
      resolvePromise({ app, port, defaultProfileId });
    });
  });
}

class DesktopFileStorage implements FileStorage {
  private port = 0;

  constructor(
    private readonly inner: LocalFileStorage,
    private readonly storageDir: string,
  ) {}

  setPort(port: number): void {
    this.port = port;
  }

  put(file: StoredFileInput): Promise<StoredFile> {
    return this.inner.put(file);
  }

  get(fileId: string): Promise<StoredFileContent> {
    return this.inner.get(fileId);
  }

  async getSignedUrl(fileId: string): Promise<string> {
    await this.inner.get(fileId);
    return `http://localhost:${this.port}/storage/${fileId}`;
  }

  delete(fileId: string): Promise<void> {
    return this.inner.delete(fileId);
  }
}
