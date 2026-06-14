import type { Knex } from "knex";
import type {
  AttachGeneratedDocumentInput,
  GeneratedDocument,
  JobApplication,
  JobApplicationRepository,
  MatchAnalysisResult,
  ScrapeBundle,
} from "@link2cv/domain";
import type { CreateJobApplicationInput, JobApplicationStatus } from "@link2cv/domain";
import { randomUUID } from "node:crypto";

export class PostgresJobApplicationRepository implements JobApplicationRepository {
  constructor(private readonly db: Knex) {}

  async create(input: CreateJobApplicationInput): Promise<JobApplication> {
    const id = randomUUID();
    const [row] = await this.db("job_applications")
      .insert({
        id,
        profile_id: input.profileId,
        source_url: input.sourceUrl,
        status: "queued",
      })
      .returning("*");

    return toJobApplication(row);
  }

  async findById(id: string): Promise<JobApplication | null> {
    const row = await this.db("job_applications").where({ id }).first();
    return row ? toJobApplication(row) : null;
  }

  async listByProfileId(profileId: string): Promise<JobApplication[]> {
    const rows = await this.db("job_applications")
      .where({ profile_id: profileId })
      .orderBy("created_at", "desc");

    return rows.map(toJobApplication);
  }

  async listByStatus(status: JobApplicationStatus): Promise<JobApplication[]> {
    const rows = await this.db("job_applications").where({ status }).orderBy("created_at", "asc");

    return rows.map(toJobApplication);
  }

  async updateStatus(
    id: string,
    status: JobApplicationStatus,
    failureReason?: string,
  ): Promise<void> {
    await this.db("job_applications")
      .where({ id })
      .update({
        status,
        failure_reason: failureReason ?? null,
        updated_at: this.db.fn.now(),
      });
  }

  async saveScrapeBundle(id: string, scrape: ScrapeBundle): Promise<void> {
    await this.db("job_applications")
      .where({ id })
      .update({
        scrape_bundle: JSON.stringify(scrape),
        updated_at: this.db.fn.now(),
      });
  }

  async getScrapeBundle(id: string): Promise<ScrapeBundle | null> {
    const row = await this.db("job_applications").select("scrape_bundle").where({ id }).first();
    return (row?.scrape_bundle as ScrapeBundle | undefined) ?? null;
  }

  async saveMatchAnalysis(id: string, result: MatchAnalysisResult): Promise<void> {
    await this.db("job_applications")
      .where({ id })
      .update({
        match_analysis: JSON.stringify(result),
        updated_at: this.db.fn.now(),
      });
  }

  async getMatchAnalysis(id: string): Promise<MatchAnalysisResult | null> {
    const row = await this.db("job_applications").select("match_analysis").where({ id }).first();
    return (row?.match_analysis as MatchAnalysisResult | undefined) ?? null;
  }

  async attachGeneratedDocument(input: AttachGeneratedDocumentInput): Promise<GeneratedDocument> {
    const id = randomUUID();
    const [row] = await this.db("generated_documents")
      .insert({
        id,
        job_application_id: input.jobApplicationId,
        kind: input.kind,
        file_id: input.fileId,
        file_name: input.fileName,
        content_type: input.contentType,
      })
      .returning("*");

    return toGeneratedDocument(row);
  }

  async listGeneratedDocuments(jobApplicationId: string): Promise<GeneratedDocument[]> {
    const rows = await this.db("generated_documents")
      .where({ job_application_id: jobApplicationId })
      .orderBy("created_at", "asc");

    return rows.map(toGeneratedDocument);
  }
}

function toJobApplication(row: Record<string, unknown>): JobApplication {
  return {
    id: String(row.id),
    profileId: String(row.profile_id),
    sourceUrl: String(row.source_url),
    status: row.status as JobApplicationStatus,
    failureReason: nullableString(row.failure_reason),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

function toGeneratedDocument(row: Record<string, unknown>): GeneratedDocument {
  return {
    id: String(row.id),
    jobApplicationId: String(row.job_application_id),
    kind: row.kind as GeneratedDocument["kind"],
    fileId: String(row.file_id),
    fileName: String(row.file_name),
    contentType: "application/pdf",
    createdAt: new Date(String(row.created_at)),
  };
}

function nullableString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
