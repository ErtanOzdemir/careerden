import type { AppEnv } from "@link2cv/config";
import type { JobApplicationRepository, JobSiteScraper } from "@link2cv/domain";
import {
  CareerPageScraper,
  CompanyWebsiteScraper,
  createFileStorage,
  createDb,
  HtmlTemplateRenderer,
  LinkedInCompanyScraper,
  LinkedInJobScraper,
  LinkedInSessionManager,
  AiProviderFactory,
  PlaywrightPdfRenderer,
  PostgresJobApplicationRepository,
  PostgresUserProfileRepository,
} from "@link2cv/infrastructure";
import {
  ExtractJobRequirementsUseCase,
  GenerateDocumentsUseCase,
  ProcessJobApplicationUseCase,
  RunMatchAnalysisUseCase,
} from "@link2cv/application";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface WorkerDependencies {
  processor: ProcessJobApplicationUseCase;
  connection: { host: string; port: number };
  jobApplications: JobApplicationRepository;
}

export function createWorkerDependencies(env: AppEnv): WorkerDependencies {
  const redisUrl = new URL(env.REDIS_URL!);
  const connection = {
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379),
  };

  const db = createDb(env.DATABASE_URL);
  const jobApplications = new PostgresJobApplicationRepository(db);
  const profiles = new PostgresUserProfileRepository(db);

  const __dirname = fileURLToPath(new URL(".", import.meta.url));
  const sessionDir = resolve(__dirname, "../../../storage/linkedin-session");

  const linkedInSessionManager = new LinkedInSessionManager(
    sessionDir,
    env.LINKEDIN_SESSION_SECRET,
  );

  const aiProvider = new AiProviderFactory({
    aiProvider: env.AI_PROVIDER,
    openaiApiKey: env.OPENAI_API_KEY,
    geminiApiKey: env.GEMINI_API_KEY,
    deepseekApiKey: env.DEEPSEEK_API_KEY,
  }).create();

  const runMatchAnalysis = new RunMatchAnalysisUseCase(
    aiProvider,
    jobApplications,
  );
  const extractJobRequirements = new ExtractJobRequirementsUseCase(aiProvider);

  const storage = createFileStorage({
    endpoint: env.RUSTFS_ENDPOINT,
    accessKeyId: env.RUSTFS_ACCESS_KEY,
    secretAccessKey: env.RUSTFS_SECRET_KEY,
    bucket: env.RUSTFS_BUCKET,
    region: env.RUSTFS_REGION,
    publicEndpoint: env.RUSTFS_PUBLIC_ENDPOINT,
  });
  const generateDocuments = new GenerateDocumentsUseCase(
    new HtmlTemplateRenderer(),
    new PlaywrightPdfRenderer(),
    storage,
    jobApplications,
  );

  const scrapers: {
    job: JobSiteScraper;
    companyLinkedIn: JobSiteScraper;
    companyWebsite: JobSiteScraper;
    careerPage: JobSiteScraper;
  } = {
    job: new LinkedInJobScraper(linkedInSessionManager),
    companyLinkedIn: new LinkedInCompanyScraper(linkedInSessionManager),
    companyWebsite: new CompanyWebsiteScraper(),
    careerPage: new CareerPageScraper(),
  };

  const processor = new ProcessJobApplicationUseCase(
    jobApplications,
    profiles,
    scrapers,
    extractJobRequirements,
    runMatchAnalysis,
    generateDocuments,
  );

  return { processor, connection, jobApplications };
}
