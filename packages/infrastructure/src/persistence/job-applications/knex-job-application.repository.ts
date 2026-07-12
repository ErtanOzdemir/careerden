import type { Knex } from "knex";
import type {
  AttachGeneratedDocumentInput,
  ClaimNextScrapeJobInput,
  CreateJobApplicationContactInput,
  CreateJobApplicationEventInput,
  CreateJobApplicationFollowUpInput,
  DocumentContent,
  GeneratedDocument,
  JobApplication,
  JobApplicationContact,
  JobApplicationEvent,
  JobApplicationFollowUp,
  JobApplicationRepository,
  ListJobApplicationsFilter,
  MatchAnalysisResult,
  ScrapeBundle,
  UpdateJobApplicationContactInput,
  UpdateJobApplicationFollowUpInput,
  UpdateJobApplicationTrackingInput,
} from "@link2cv/domain";
import type { CreateJobApplicationInput, JobApplicationStatus } from "@link2cv/domain";
import { randomUUID } from "node:crypto";
import {
  toGeneratedDocument,
  toJobApplication,
  toJobApplicationContact,
  toJobApplicationEvent,
  toJobApplicationFollowUp,
} from "../mappers.js";

export class KnexJobApplicationRepository implements JobApplicationRepository {
  constructor(private readonly db: Knex) {}

  async create(input: CreateJobApplicationInput): Promise<JobApplication> {
    return this.db.transaction(async (transaction) => {
      const id = randomUUID();
      const [row] = await transaction("job_applications")
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
          application_status: input.applicationStatus ?? "saved",
          priority: input.priority ?? null,
          tags: JSON.stringify(input.tags ?? []),
          last_response_at: input.lastResponseAt ?? null,
          salary_min_amount: input.salaryMinAmount ?? null,
          salary_max_amount: input.salaryMaxAmount ?? null,
          salary_currency: input.salaryCurrency ?? null,
          salary_period: input.salaryPeriod ?? null,
          salary_type: input.salaryType ?? null,
          metadata: JSON.stringify(input.metadata ?? {}),
          scrape_attempt_count: 0,
        })
        .returning("*");
      const jobApplication = toJobApplication(row);
      await new KnexJobApplicationRepository(transaction).addEvent({
        jobApplicationId: jobApplication.id,
        type: "created",
        title: input.sourceUrl ? "LinkedIn job submitted" : "Application created",
        metadata: { sourceUrl: input.sourceUrl },
      });
      return jobApplication;
    });
  }

  async findById(id: string): Promise<JobApplication | null> {
    const row = await this.db("job_applications").where({ id }).first();
    return row ? toJobApplication(row) : null;
  }

  async claimNextScrapeJob(input: ClaimNextScrapeJobInput): Promise<JobApplication | null> {
    const now = input.now ?? new Date();
    const claimExpiresAt = new Date(now.getTime() + input.claimDurationMs);

    return this.db.transaction(async (transaction) => {
      const row = await transaction("job_applications")
        .where({ profile_id: input.profileId })
        .whereNotNull("source_url")
        .andWhere((builder) => {
          builder
            .where((queued) => {
              queued.where("status", "queued").andWhere((retry) => {
                retry
                  .whereNull("next_scrape_attempt_at")
                  .orWhere("next_scrape_attempt_at", "<=", now);
              });
            })
            .orWhere((expired) => {
              expired
                .where("status", "scraping")
                .whereNotNull("scrape_claim_expires_at")
                .where("scrape_claim_expires_at", "<=", now);
            });
        })
        .orderBy("created_at", "asc")
        .forUpdate()
        .skipLocked()
        .first();

      if (!row) {
        return null;
      }

      const [updated] = await transaction("job_applications")
        .where({ id: row.id })
        .update({
          status: "scraping",
          failure_reason: null,
          scrape_claimed_by: input.claimedBy,
          scrape_claim_expires_at: claimExpiresAt,
          scrape_attempt_count: this.db.raw("scrape_attempt_count + 1"),
          next_scrape_attempt_at: null,
          updated_at: now,
        })
        .returning("*");

      return toJobApplication(updated);
    });
  }

  async renewScrapeClaim(
    id: string,
    input: {
      claimedBy: string;
      claimDurationMs: number;
      now?: Date;
    },
  ): Promise<JobApplication | null> {
    const now = input.now ?? new Date();
    const [row] = await this.db("job_applications")
      .where({ id, scrape_claimed_by: input.claimedBy })
      .update({
        scrape_claim_expires_at: new Date(now.getTime() + input.claimDurationMs),
        updated_at: now,
      })
      .returning("*");

    return row ? toJobApplication(row) : null;
  }

  async recordScrapeFailure(
    id: string,
    input: {
      claimedBy: string;
      reason: string;
      maxAttempts: number;
      backoffMs: number;
      now?: Date;
    },
  ): Promise<JobApplication | null> {
    const now = input.now ?? new Date();

    return this.db.transaction(async (transaction) => {
      const row = await transaction("job_applications")
        .where({ id, scrape_claimed_by: input.claimedBy })
        .forUpdate()
        .first();

      if (!row) {
        return null;
      }

      const attemptCount = Number(row.scrape_attempt_count ?? 0);
      const isFinalFailure = attemptCount >= input.maxAttempts;
      const [updated] = await transaction("job_applications")
        .where({ id })
        .update({
          status: isFinalFailure ? "failed" : "queued",
          failure_reason: input.reason,
          scrape_claimed_by: null,
          scrape_claim_expires_at: null,
          next_scrape_attempt_at: isFinalFailure ? null : new Date(now.getTime() + input.backoffMs),
          updated_at: now,
        })
        .returning("*");

      return toJobApplication(updated);
    });
  }

  async deleteById(id: string): Promise<void> {
    await this.db.transaction(async (transaction) => {
      await transaction("generated_documents").where({ job_application_id: id }).delete();
      await transaction("job_application_contacts").where({ job_application_id: id }).delete();
      await transaction("job_application_follow_ups").where({ job_application_id: id }).delete();
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
          scrape_claimed_by: null,
          scrape_claim_expires_at: null,
          scrape_attempt_count: 0,
          next_scrape_attempt_at: null,
          scrape_bundle: null,
          company_logo_file_id: null,
          match_analysis: null,
          document_content: null,
          analysis_attempt_id: null,
          document_generation_attempt_id: null,
          updated_at: transaction.fn.now(),
        })
        .returning("*");

      if (!row) {
        throw new Error(`Job application ${id} was not found`);
      }

      return toJobApplication(row);
    });
  }

  async resetAnalysis(id: string): Promise<JobApplication> {
    return this.db.transaction(async (transaction) => {
      await transaction("generated_documents").where({ job_application_id: id }).delete();
      const [row] = await transaction("job_applications")
        .where({ id })
        .update({
          status: "scraped",
          failure_reason: null,
          scrape_claimed_by: null,
          scrape_claim_expires_at: null,
          next_scrape_attempt_at: null,
          match_analysis: null,
          document_content: null,
          analysis_attempt_id: null,
          document_generation_attempt_id: null,
          updated_at: transaction.fn.now(),
        })
        .returning("*");

      if (!row) {
        throw new Error(`Job application ${id} was not found`);
      }

      return toJobApplication(row);
    });
  }

  async beginAnalysis(id: string, attemptId: string): Promise<boolean> {
    const updated = await this.db("job_applications")
      .where({ id, analysis_attempt_id: attemptId })
      .whereIn("status", ["scraped", "analyzing", "failed"])
      .update({
        status: "analyzing",
        analysis_attempt_id: attemptId,
        failure_reason: null,
        updated_at: this.db.fn.now(),
      });
    return updated > 0;
  }

  async setAnalysisAttempt(id: string, attemptId: string): Promise<void> {
    const updated = await this.db("job_applications")
      .where({ id, status: "scraped" })
      .update({ analysis_attempt_id: attemptId, updated_at: this.db.fn.now() });
    if (updated === 0) throw new Error(`Job application ${id} is not ready for analysis`);
  }

  async completeAnalysis(
    id: string,
    attemptId: string,
    result: MatchAnalysisResult,
    content: DocumentContent,
  ): Promise<boolean> {
    const updated = await this.db("job_applications")
      .where({ id, analysis_attempt_id: attemptId, status: "analyzing" })
      .update({
        match_analysis: JSON.stringify(result),
        document_content: JSON.stringify(content),
        status: "review_ready",
        failure_reason: null,
        updated_at: this.db.fn.now(),
      });
    return updated > 0;
  }

  async failAnalysis(id: string, attemptId: string, reason: string): Promise<boolean> {
    const updated = await this.db("job_applications")
      .where({ id, analysis_attempt_id: attemptId, status: "analyzing" })
      .update({
        status: "failed",
        failure_reason: reason,
        updated_at: this.db.fn.now(),
      });
    return updated > 0;
  }

  async beginDocumentGeneration(
    id: string,
    attemptId: string,
  ): Promise<{ started: boolean; supersededAttemptId?: string }> {
    return this.db.transaction(async (transaction) => {
      const row = await transaction("job_applications").where({ id }).forUpdate().first();
      if (
        !row ||
        !["review_ready", "generating_documents", "completed"].includes(String(row.status))
      ) {
        return { started: false };
      }
      const supersededAttemptId =
        row.status === "generating_documents" &&
        typeof row.document_generation_attempt_id === "string"
          ? row.document_generation_attempt_id
          : undefined;
      await transaction("job_applications").where({ id }).update({
        status: "generating_documents",
        document_generation_attempt_id: attemptId,
        failure_reason: null,
        updated_at: transaction.fn.now(),
      });
      return { started: true, ...(supersededAttemptId ? { supersededAttemptId } : {}) };
    });
  }

  async completeDocumentGeneration(id: string, attemptId: string): Promise<boolean> {
    const updated = await this.db("job_applications")
      .where({ id, document_generation_attempt_id: attemptId, status: "generating_documents" })
      .update({ status: "completed", failure_reason: null, updated_at: this.db.fn.now() });
    return updated > 0;
  }

  async failDocumentGeneration(id: string, attemptId: string, reason: string): Promise<boolean> {
    const updated = await this.db("job_applications")
      .where({ id, document_generation_attempt_id: attemptId, status: "generating_documents" })
      .update({ status: "failed", failure_reason: reason, updated_at: this.db.fn.now() });
    return updated > 0;
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
        ...(status === "failed" ? { scrape_claimed_by: null, scrape_claim_expires_at: null } : {}),
        ...(status === "failed" ? { next_scrape_attempt_at: null } : {}),
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
    if ("lastResponseAt" in input) update.last_response_at = input.lastResponseAt ?? null;
    if ("salaryMinAmount" in input) update.salary_min_amount = input.salaryMinAmount ?? null;
    if ("salaryMaxAmount" in input) update.salary_max_amount = input.salaryMaxAmount ?? null;
    if ("salaryCurrency" in input) update.salary_currency = input.salaryCurrency ?? null;
    if ("salaryPeriod" in input) update.salary_period = input.salaryPeriod ?? null;
    if ("salaryType" in input) update.salary_type = input.salaryType ?? null;
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
      scrape_claimed_by: null,
      scrape_claim_expires_at: null,
      scrape_attempt_count: 0,
      next_scrape_attempt_at: null,
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
    const value = row?.scrape_bundle;
    if (!value) return null;
    return typeof value === "string"
      ? (JSON.parse(value) as ScrapeBundle)
      : (value as ScrapeBundle);
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
    const value = row?.match_analysis;
    if (!value) return null;
    return typeof value === "string"
      ? (JSON.parse(value) as MatchAnalysisResult)
      : (value as MatchAnalysisResult);
  }

  async saveDocumentContent(id: string, content: DocumentContent): Promise<void> {
    const updated = await this.db("job_applications")
      .where({ id })
      .update({
        document_content: JSON.stringify(content),
        updated_at: this.db.fn.now(),
      });

    if (updated === 0) {
      throw new Error(`Job application ${id} was not found`);
    }
  }

  async getDocumentContent(id: string): Promise<DocumentContent | null> {
    const row = await this.db("job_applications").where({ id }).select("document_content").first();
    const value = row?.document_content;
    if (!value) return null;
    return typeof value === "string"
      ? (JSON.parse(value) as DocumentContent)
      : (value as DocumentContent);
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
      .orderBy("occurred_at", "desc")
      .orderBy("created_at", "desc");

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

  async createFollowUp(input: CreateJobApplicationFollowUpInput): Promise<JobApplicationFollowUp> {
    const id = randomUUID();
    const [row] = await this.db("job_application_follow_ups")
      .insert({
        id,
        job_application_id: input.jobApplicationId,
        profile_id: input.profileId,
        title: input.title,
        description: input.description ?? null,
        scheduled_at: input.scheduledAt,
      })
      .returning("*");

    return toJobApplicationFollowUp(row);
  }

  async findFollowUpById(id: string): Promise<JobApplicationFollowUp | null> {
    const row = await this.db("job_application_follow_ups").where({ id }).first();
    return row ? toJobApplicationFollowUp(row) : null;
  }

  async listFollowUps(jobApplicationId: string): Promise<JobApplicationFollowUp[]> {
    const rows = await this.db("job_application_follow_ups")
      .where({ job_application_id: jobApplicationId })
      .orderBy("scheduled_at", "asc");

    return rows.map(toJobApplicationFollowUp);
  }

  async updateFollowUp(
    id: string,
    input: UpdateJobApplicationFollowUpInput,
  ): Promise<JobApplicationFollowUp> {
    const update: Record<string, unknown> = {
      updated_at: this.db.fn.now(),
    };

    if ("title" in input) update.title = input.title;
    if ("description" in input) update.description = input.description ?? null;
    if ("scheduledAt" in input) update.scheduled_at = input.scheduledAt;

    const [row] = await this.db("job_application_follow_ups")
      .where({ id })
      .update(update)
      .returning("*");

    if (!row) {
      throw new Error(`Job application follow-up ${id} was not found`);
    }

    return toJobApplicationFollowUp(row);
  }

  async deleteFollowUp(id: string): Promise<void> {
    await this.db("job_application_follow_ups").where({ id }).delete();
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

function nullableString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function applyFilters(query: Knex.QueryBuilder, filter: ListJobApplicationsFilter): void {
  if (filter.applicationStatus) query.where("application_status", filter.applicationStatus);
  if (filter.processingStatus) query.where("status", filter.processingStatus);
  if (filter.priority) query.where("priority", filter.priority);
  if (filter.roleType) query.where("role_type", filter.roleType);
  if (filter.tag)
    query.whereRaw("EXISTS (SELECT 1 FROM json_each(tags) WHERE value = ?)", [filter.tag]);
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
        .orWhereRaw("tags LIKE ?", [`%${filter.search}%`]);
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
