import { Worker } from "bullmq";
import { Pool } from "pg";
import {
  GenerateDocumentsUseCase,
  ProcessJobApplicationUseCase,
  RunMatchAnalysisUseCase,
} from "@link2cv/application";
import { loadEnv } from "@link2cv/config";
import {
  CareerPageScraper,
  BullMqJobApplicationQueue,
  CompanyWebsiteScraper,
  DeepSeekMatchingProvider,
  HtmlTemplateRenderer,
  jobApplicationProcessingQueueName,
  LinkedInCompanyScraper,
  LinkedInJobScraper,
  LinkedInSessionManager,
  LocalFileStorage,
  LocalHeuristicMatchingProvider,
  GeminiMatchingProvider,
  OpenAiMatchingProvider,
  PlaywrightPdfRenderer,
  PostgresJobApplicationRepository,
  PostgresUserProfileRepository,
} from "@link2cv/infrastructure";

const env = loadEnv();
if (!env.REDIS_URL) {
  throw new Error("REDIS_URL is required to start the worker");
}

const redisUrl = new URL(env.REDIS_URL);
const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
};

const pool = new Pool({ connectionString: env.DATABASE_URL });
const jobApplications = new PostgresJobApplicationRepository(pool);
const profiles = new PostgresUserProfileRepository(pool);

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const sessionDir = resolve(__dirname, "../../../storage/linkedin-session");
console.log("Worker linkedin session dir:", sessionDir);

const linkedInSessionManager = new LinkedInSessionManager(
  sessionDir,
  env.LINKEDIN_SESSION_SECRET,
);
const matchingProvider =
  env.AI_PROVIDER === "deepseek" && env.DEEPSEEK_API_KEY
    ? new DeepSeekMatchingProvider(env.DEEPSEEK_API_KEY)
    : env.AI_PROVIDER === "gemini" && env.GEMINI_API_KEY
      ? new GeminiMatchingProvider(env.GEMINI_API_KEY)
      : env.AI_PROVIDER === "openai" && env.OPENAI_API_KEY
        ? new OpenAiMatchingProvider(env.OPENAI_API_KEY)
        : new LocalHeuristicMatchingProvider();
const runMatchAnalysis = new RunMatchAnalysisUseCase(
  matchingProvider,
  jobApplications,
);
const generateDocuments = new GenerateDocumentsUseCase(
  new HtmlTemplateRenderer(),
  new PlaywrightPdfRenderer(),
  new LocalFileStorage(env.FILE_STORAGE_DIR),
  jobApplications,
);
const processor = new ProcessJobApplicationUseCase(
  jobApplications,
  profiles,
  {
    job: new LinkedInJobScraper(linkedInSessionManager),
    companyLinkedIn: new LinkedInCompanyScraper(),
    companyWebsite: new CompanyWebsiteScraper(),
    careerPage: new CareerPageScraper(),
  },
  runMatchAnalysis,
  generateDocuments,
);

await requeueQueuedJobApplications();

new Worker(
  jobApplicationProcessingQueueName,
  async (job) => {
    await processor.execute(job.data.jobApplicationId);
  },
  {
    connection,
  },
);

console.log(
  `Link2CV worker listening on queue ${jobApplicationProcessingQueueName}`,
);

async function requeueQueuedJobApplications(): Promise<void> {
  const queue = new BullMqJobApplicationQueue(connection);
  const queued = await jobApplications.listByStatus("queued");

  for (const jobApplication of queued) {
    await queue.enqueue({ jobApplicationId: jobApplication.id });
  }

  if (queued.length > 0) {
    console.log(`Requeued ${queued.length} queued job application(s)`);
  }
}
