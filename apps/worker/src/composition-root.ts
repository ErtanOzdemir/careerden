import type { AppEnv } from "@link2cv/config";
import type { JobApplicationRepository, JobSiteScraper } from "@link2cv/domain";
import { Pool } from "pg";
import {
  CareerPageScraper,
  CompanyWebsiteScraper,
  HtmlTemplateRenderer,
  LinkedInCompanyScraper,
  LinkedInJobScraper,
  LinkedInSessionManager,
  LocalFileStorage,
  MatchingProviderFactory,
  PlaywrightPdfRenderer,
  PostgresJobApplicationRepository,
  PostgresUserProfileRepository,
} from "@link2cv/infrastructure";
import {
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

  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const jobApplications = new PostgresJobApplicationRepository(pool);
  const profiles = new PostgresUserProfileRepository(pool);

  const __dirname = fileURLToPath(new URL(".", import.meta.url));
  const sessionDir = resolve(__dirname, "../../../storage/linkedin-session");

  const linkedInSessionManager = new LinkedInSessionManager(
    sessionDir,
    env.LINKEDIN_SESSION_SECRET,
  );

  const matchingProvider = new MatchingProviderFactory({
    aiProvider: env.AI_PROVIDER,
    openaiApiKey: env.OPENAI_API_KEY,
    geminiApiKey: env.GEMINI_API_KEY,
    deepseekApiKey: env.DEEPSEEK_API_KEY,
  }).create();

  const runMatchAnalysis = new RunMatchAnalysisUseCase(
    matchingProvider,
    jobApplications,
  );

  const storage = new LocalFileStorage(env.FILE_STORAGE_DIR);
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
    companyLinkedIn: new LinkedInCompanyScraper(),
    companyWebsite: new CompanyWebsiteScraper(),
    careerPage: new CareerPageScraper(),
  };

  const processor = new ProcessJobApplicationUseCase(
    jobApplications,
    profiles,
    scrapers,
    runMatchAnalysis,
    generateDocuments,
  );

  return { processor, connection, jobApplications };
}
