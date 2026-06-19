import type { Knex } from "knex";
import type {
  AttachGeneratedDocumentInput,
  CreateJobApplicationContactInput,
  CreateJobApplicationEventInput,
  CreateJobApplicationInterviewInput,
  GeneratedDocument,
  JobApplication,
  JobApplicationContact,
  JobApplicationEvent,
  JobApplicationInterview,
  JobApplicationRepository,
  ListJobApplicationsFilter,
  MatchAnalysisResult,
  ScrapeBundle,
  UpdateJobApplicationContactInput,
  UpdateJobApplicationInterviewInput,
  UpdateJobApplicationTrackingInput,
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
        source_url: input.sourceUrl ?? null,
        status: input.sourceUrl ? "queued" : "completed",
        company_name: input.companyName ?? null,
        role_title: input.roleTitle ?? null,
        role_type: input.roleType ?? null,
        job_url: input.jobUrl ?? input.sourceUrl ?? null,
        date_applied: input.dateApplied ?? null,
        application_status: input.applicationStatus ?? "applied",
        priority: input.priority ?? "medium",
        tags: JSON.stringify(input.tags ?? []),
        next_follow_up_at: input.nextFollowUpAt ?? null,
        last_response_at: input.lastResponseAt ?? null,
        metadata: JSON.stringify(input.metadata ?? {}),
      })
      .returning("*");

    const jobApplication = toJobApplication(row);

    await this.addEvent({
      jobApplicationId: jobApplication.id,
      type: "created",
      title: input.sourceUrl ? "LinkedIn job submitted" : "Application created",
      metadata: { sourceUrl: input.sourceUrl },
    });

    return jobApplication;
  }

  async findById(id: string): Promise<JobApplication | null> {
    const row = await this.db("job_applications").where({ id }).first();
    return row ? toJobApplication(row) : null;
  }

  async deleteById(id: string): Promise<void> {
    await this.db.transaction(async (transaction) => {
      await transaction("generated_documents").where({ job_application_id: id }).delete();
      await transaction("job_application_interviews").where({ job_application_id: id }).delete();
      await transaction("job_application_contacts").where({ job_application_id: id }).delete();
      await transaction("job_application_events").where({ job_application_id: id }).delete();
      await transaction("job_applications").where({ id }).delete();
    });
  }

  async listByProfileId(
    profileId: string,
    filter: ListJobApplicationsFilter = {},
  ): Promise<JobApplication[]> {
    const query = this.db("job_applications")
      .where({ profile_id: profileId })
      .modify((builder) => applyFilters(builder, filter))
      .orderBy(toColumnName(filter.sortBy ?? "updatedAt"), filter.sortDirection ?? "desc");
    const rows = await query;

    return rows.map(toJobApplication);
  }

  async listByStatus(status: JobApplicationStatus): Promise<JobApplication[]> {
    const rows = await this.db("job_applications").where({ status }).orderBy("created_at", "asc");

    return rows.map(toJobApplication);
  }

  async resetProcessing(id: string): Promise<JobApplication> {
    return this.db.transaction(async (transaction) => {
      await transaction("generated_documents").where({ job_application_id: id }).delete();
      const [row] = await transaction("job_applications")
        .where({ id })
        .update({
          status: "queued",
          failure_reason: null,
          scrape_bundle: null,
          company_logo_file_id: null,
          match_analysis: null,
          updated_at: transaction.fn.now(),
        })
        .returning("*");

      if (!row) {
        throw new Error(`Job application ${id} was not found`);
      }

      return toJobApplication(row);
    });
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

  async updateTracking(
    id: string,
    input: UpdateJobApplicationTrackingInput,
  ): Promise<JobApplication> {
    const update: Record<string, unknown> = {
      updated_at: this.db.fn.now(),
    };

    if ("companyName" in input) update.company_name = input.companyName ?? null;
    if ("roleTitle" in input) update.role_title = input.roleTitle ?? null;
    if ("roleType" in input) update.role_type = input.roleType ?? null;
    if ("jobUrl" in input) update.job_url = input.jobUrl ?? null;
    if ("dateApplied" in input) update.date_applied = input.dateApplied ?? null;
    if ("applicationStatus" in input) update.application_status = input.applicationStatus;
    if ("priority" in input) update.priority = input.priority;
    if ("tags" in input) update.tags = JSON.stringify(input.tags ?? []);
    if ("nextFollowUpAt" in input) update.next_follow_up_at = input.nextFollowUpAt ?? null;
    if ("lastResponseAt" in input) update.last_response_at = input.lastResponseAt ?? null;
    if ("metadata" in input) update.metadata = JSON.stringify(input.metadata ?? {});

    const [row] = await this.db("job_applications").where({ id }).update(update).returning("*");

    if (!row) {
      throw new Error(`Job application ${id} was not found`);
    }

    return toJobApplication(row);
  }

  async saveScrapeBundle(id: string, scrape: ScrapeBundle): Promise<void> {
    const update: Record<string, unknown> = {
      scrape_bundle: JSON.stringify(scrape),
      company_name: this.db.raw("coalesce(company_name, ?)", [scrape.job.companyName]),
      role_title: this.db.raw("coalesce(role_title, ?)", [scrape.job.title]),
      job_url: this.db.raw("coalesce(job_url, source_url)"),
      updated_at: this.db.fn.now(),
    };

    if (scrape.companyLinkedIn?.logoFileId) {
      update.company_logo_file_id = scrape.companyLinkedIn.logoFileId;
    }

    await this.db("job_applications").where({ id }).update(update);
  }

  async getScrapeBundle(id: string): Promise<ScrapeBundle | null> {
    const row = await this.db("job_applications").select("scrape_bundle").where({ id }).first();
    return (row?.scrape_bundle as ScrapeBundle | undefined) ?? null;
  }

  async getCompanyLogoFileId(id: string): Promise<string | null> {
    const row = await this.db("job_applications")
      .select("company_logo_file_id")
      .where({ id })
      .first();

    return nullableString(row?.company_logo_file_id) ?? null;
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

  async addEvent(input: CreateJobApplicationEventInput): Promise<JobApplicationEvent> {
    const id = randomUUID();
    const [row] = await this.db("job_application_events")
      .insert({
        id,
        job_application_id: input.jobApplicationId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        occurred_at: input.occurredAt ?? this.db.fn.now(),
        metadata: JSON.stringify(input.metadata ?? {}),
      })
      .returning("*");

    return toJobApplicationEvent(row);
  }

  async listEvents(jobApplicationId: string): Promise<JobApplicationEvent[]> {
    const rows = await this.db("job_application_events")
      .where({ job_application_id: jobApplicationId })
      .orderBy("occurred_at", "desc");

    return rows.map(toJobApplicationEvent);
  }

  async createContact(input: CreateJobApplicationContactInput): Promise<JobApplicationContact> {
    const id = randomUUID();
    const [row] = await this.db("job_application_contacts")
      .insert({
        id,
        job_application_id: input.jobApplicationId,
        name: input.name,
        role: input.role ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        linkedin_url: input.linkedInUrl ?? null,
        notes: input.notes ?? null,
      })
      .returning("*");

    return toJobApplicationContact(row);
  }

  async findContactById(id: string): Promise<JobApplicationContact | null> {
    const row = await this.db("job_application_contacts").where({ id }).first();
    return row ? toJobApplicationContact(row) : null;
  }

  async listContacts(jobApplicationId: string): Promise<JobApplicationContact[]> {
    const rows = await this.db("job_application_contacts")
      .where({ job_application_id: jobApplicationId })
      .orderBy("created_at", "asc");

    return rows.map(toJobApplicationContact);
  }

  async updateContact(
    id: string,
    input: UpdateJobApplicationContactInput,
  ): Promise<JobApplicationContact> {
    const update: Record<string, unknown> = {
      updated_at: this.db.fn.now(),
    };

    if ("name" in input) update.name = input.name;
    if ("role" in input) update.role = input.role ?? null;
    if ("email" in input) update.email = input.email ?? null;
    if ("phone" in input) update.phone = input.phone ?? null;
    if ("linkedInUrl" in input) update.linkedin_url = input.linkedInUrl ?? null;
    if ("notes" in input) update.notes = input.notes ?? null;

    const [row] = await this.db("job_application_contacts")
      .where({ id })
      .update(update)
      .returning("*");

    if (!row) {
      throw new Error(`Job application contact ${id} was not found`);
    }

    return toJobApplicationContact(row);
  }

  async deleteContact(id: string): Promise<void> {
    await this.db("job_application_contacts").where({ id }).delete();
  }

  async createInterview(
    input: CreateJobApplicationInterviewInput,
  ): Promise<JobApplicationInterview> {
    const id = randomUUID();
    const [row] = await this.db("job_application_interviews")
      .insert({
        id,
        job_application_id: input.jobApplicationId,
        title: input.title,
        type: input.type ?? null,
        scheduled_at: input.scheduledAt,
        status: input.status ?? "upcoming",
        notes: input.notes ?? null,
        prep_notes: input.prepNotes ?? null,
      })
      .returning("*");

    return toJobApplicationInterview(row);
  }

  async findInterviewById(id: string): Promise<JobApplicationInterview | null> {
    const row = await this.db("job_application_interviews").where({ id }).first();
    return row ? toJobApplicationInterview(row) : null;
  }

  async listInterviews(jobApplicationId: string): Promise<JobApplicationInterview[]> {
    const rows = await this.db("job_application_interviews")
      .where({ job_application_id: jobApplicationId })
      .orderBy("scheduled_at", "asc")
      .orderBy("created_at", "asc");

    return rows.map(toJobApplicationInterview);
  }

  async updateInterview(
    id: string,
    input: UpdateJobApplicationInterviewInput,
  ): Promise<JobApplicationInterview> {
    const update: Record<string, unknown> = {
      updated_at: this.db.fn.now(),
    };

    if ("title" in input) update.title = input.title;
    if ("type" in input) update.type = input.type ?? null;
    if ("scheduledAt" in input) update.scheduled_at = input.scheduledAt;
    if ("status" in input) update.status = input.status;
    if ("notes" in input) update.notes = input.notes ?? null;
    if ("prepNotes" in input) update.prep_notes = input.prepNotes ?? null;

    const [row] = await this.db("job_application_interviews")
      .where({ id })
      .update(update)
      .returning("*");

    if (!row) {
      throw new Error(`Job application interview ${id} was not found`);
    }

    return toJobApplicationInterview(row);
  }

  async deleteInterview(id: string): Promise<void> {
    await this.db("job_application_interviews").where({ id }).delete();
  }

  async attachGeneratedDocument(input: AttachGeneratedDocumentInput): Promise<GeneratedDocument> {
    const existing = await this.db("generated_documents")
      .where({
        job_application_id: input.jobApplicationId,
        kind: input.kind,
        format: input.format,
      })
      .first();

    if (existing) {
      const [row] = await this.db("generated_documents")
        .where({ id: existing.id })
        .update({
          file_id: input.fileId,
          file_name: input.fileName,
          content_type: input.contentType,
          created_at: this.db.fn.now(),
        })
        .returning("*");

      return toGeneratedDocument(row);
    }

    const id = randomUUID();
    const [row] = await this.db("generated_documents")
      .insert({
        id,
        job_application_id: input.jobApplicationId,
        kind: input.kind,
        format: input.format,
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
    sourceUrl: nullableString(row.source_url),
    status: row.status as JobApplicationStatus,
    failureReason: nullableString(row.failure_reason),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
    tracking: {
      companyName: nullableString(row.company_name),
      roleTitle: nullableString(row.role_title),
      roleType: nullableString(row.role_type),
      jobUrl: nullableString(row.job_url),
      dateApplied: nullableString(row.date_applied),
      applicationStatus: (nullableString(row.application_status) ??
        "applied") as JobApplication["tracking"]["applicationStatus"],
      priority: (nullableString(row.priority) ??
        "medium") as JobApplication["tracking"]["priority"],
      tags: stringArray(row.tags),
      nextFollowUpAt: nullableDate(row.next_follow_up_at),
      lastResponseAt: nullableDate(row.last_response_at),
      metadata: record(row.metadata),
    },
  };
}

function toGeneratedDocument(row: Record<string, unknown>): GeneratedDocument {
  return {
    id: String(row.id),
    jobApplicationId: String(row.job_application_id),
    kind: row.kind as GeneratedDocument["kind"],
    format: (nullableString(row.format) ?? "pdf") as GeneratedDocument["format"],
    fileId: String(row.file_id),
    fileName: String(row.file_name),
    contentType: String(row.content_type),
    createdAt: new Date(String(row.created_at)),
  };
}

function nullableString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function nullableDate(value: unknown): Date | undefined {
  return value ? new Date(String(value)) : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toJobApplicationEvent(row: Record<string, unknown>): JobApplicationEvent {
  return {
    id: String(row.id),
    jobApplicationId: String(row.job_application_id),
    type: row.type as JobApplicationEvent["type"],
    title: String(row.title),
    body: nullableString(row.body),
    occurredAt: new Date(String(row.occurred_at)),
    metadata: record(row.metadata),
    createdAt: new Date(String(row.created_at)),
  };
}

function toJobApplicationContact(row: Record<string, unknown>): JobApplicationContact {
  return {
    id: String(row.id),
    jobApplicationId: String(row.job_application_id),
    name: String(row.name),
    role: nullableString(row.role),
    email: nullableString(row.email),
    phone: nullableString(row.phone),
    linkedInUrl: nullableString(row.linkedin_url),
    notes: nullableString(row.notes),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

function toJobApplicationInterview(row: Record<string, unknown>): JobApplicationInterview {
  return {
    id: String(row.id),
    jobApplicationId: String(row.job_application_id),
    title: String(row.title),
    type: nullableString(row.type),
    scheduledAt: new Date(String(row.scheduled_at)),
    status: row.status as JobApplicationInterview["status"],
    notes: nullableString(row.notes),
    prepNotes: nullableString(row.prep_notes),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

function applyFilters(query: Knex.QueryBuilder, filter: ListJobApplicationsFilter): void {
  if (filter.applicationStatus) query.where("application_status", filter.applicationStatus);
  if (filter.priority) query.where("priority", filter.priority);
  if (filter.roleType) query.where("role_type", filter.roleType);
  if (filter.tag) query.whereRaw("tags @> ?::jsonb", [JSON.stringify([filter.tag])]);
  if (filter.dateFrom) query.where("date_applied", ">=", filter.dateFrom);
  if (filter.dateTo) query.where("date_applied", "<=", filter.dateTo);
  if (filter.company) query.whereILike("company_name", `%${filter.company}%`);
  if (filter.role) query.whereILike("role_title", `%${filter.role}%`);

  if (filter.search) {
    query.andWhere((builder) => {
      builder
        .whereILike("company_name", `%${filter.search}%`)
        .orWhereILike("role_title", `%${filter.search}%`)
        .orWhereILike("role_type", `%${filter.search}%`)
        .orWhereRaw("tags::text ilike ?", [`%${filter.search}%`]);
    });
  }
}

function toColumnName(sortBy: ListJobApplicationsFilter["sortBy"]): string {
  if (sortBy === "dateApplied") return "date_applied";
  if (sortBy === "companyName") return "company_name";
  if (sortBy === "roleTitle") return "role_title";
  if (sortBy === "applicationStatus") return "application_status";
  return "updated_at";
}
