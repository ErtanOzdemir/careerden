import type { Pool } from "pg";
import type {
  AttachGeneratedDocumentInput,
  GeneratedDocument,
  JobApplication,
  JobApplicationRepository,
  MatchAnalysisResult,
  ScrapeBundle
} from "@link2cv/domain";
import type { CreateJobApplicationInput, JobApplicationStatus } from "@link2cv/domain";
import { randomUUID } from "node:crypto";

export class PostgresJobApplicationRepository implements JobApplicationRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateJobApplicationInput): Promise<JobApplication> {
    const id = randomUUID();
    const result = await this.pool.query(
      `
        insert into job_applications (id, profile_id, source_url, status)
        values ($1, $2, $3, 'queued')
        returning *
      `,
      [id, input.profileId, input.sourceUrl]
    );

    return toJobApplication(result.rows[0]);
  }

  async findById(id: string): Promise<JobApplication | null> {
    const result = await this.pool.query("select * from job_applications where id = $1", [id]);
    return result.rows[0] ? toJobApplication(result.rows[0]) : null;
  }

  async listByProfileId(profileId: string): Promise<JobApplication[]> {
    const result = await this.pool.query(
      "select * from job_applications where profile_id = $1 order by created_at desc",
      [profileId]
    );

    return result.rows.map(toJobApplication);
  }

  async listByStatus(status: JobApplicationStatus): Promise<JobApplication[]> {
    const result = await this.pool.query(
      "select * from job_applications where status = $1 order by created_at asc",
      [status]
    );

    return result.rows.map(toJobApplication);
  }

  async updateStatus(
    id: string,
    status: JobApplicationStatus,
    failureReason?: string
  ): Promise<void> {
    await this.pool.query(
      `
        update job_applications
        set status = $2, failure_reason = $3, updated_at = now()
        where id = $1
      `,
      [id, status, failureReason ?? null]
    );
  }

  async saveScrapeBundle(id: string, scrape: ScrapeBundle): Promise<void> {
    await this.pool.query(
      "update job_applications set scrape_bundle = $2, updated_at = now() where id = $1",
      [id, JSON.stringify(scrape)]
    );
  }

  async getScrapeBundle(id: string): Promise<ScrapeBundle | null> {
    const result = await this.pool.query("select scrape_bundle from job_applications where id = $1", [id]);
    return (result.rows[0]?.scrape_bundle as ScrapeBundle | undefined) ?? null;
  }

  async saveMatchAnalysis(id: string, result: MatchAnalysisResult): Promise<void> {
    await this.pool.query(
      "update job_applications set match_analysis = $2, updated_at = now() where id = $1",
      [id, JSON.stringify(result)]
    );
  }

  async getMatchAnalysis(id: string): Promise<MatchAnalysisResult | null> {
    const result = await this.pool.query("select match_analysis from job_applications where id = $1", [id]);
    return (result.rows[0]?.match_analysis as MatchAnalysisResult | undefined) ?? null;
  }

  async attachGeneratedDocument(input: AttachGeneratedDocumentInput): Promise<GeneratedDocument> {
    const id = randomUUID();
    const result = await this.pool.query(
      `
        insert into generated_documents (
          id, job_application_id, kind, file_id, file_name, content_type
        )
        values ($1, $2, $3, $4, $5, $6)
        returning *
      `,
      [
        id,
        input.jobApplicationId,
        input.kind,
        input.fileId,
        input.fileName,
        input.contentType
      ]
    );

    return toGeneratedDocument(result.rows[0]);
  }

  async listGeneratedDocuments(jobApplicationId: string): Promise<GeneratedDocument[]> {
    const result = await this.pool.query(
      "select * from generated_documents where job_application_id = $1 order by created_at asc",
      [jobApplicationId]
    );

    return result.rows.map(toGeneratedDocument);
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
    updatedAt: new Date(String(row.updated_at))
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
    createdAt: new Date(String(row.created_at))
  };
}

function nullableString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
