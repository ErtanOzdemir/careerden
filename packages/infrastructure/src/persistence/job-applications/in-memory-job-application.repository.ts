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
import type { CreateJobApplicationInput } from "@link2cv/domain";
import type { JobApplicationStatus } from "@link2cv/domain";
import { randomUUID } from "node:crypto";

export class InMemoryJobApplicationRepository implements JobApplicationRepository {
  private readonly analysisAttempts = new Map<string, string>();
  private readonly documentGenerationAttempts = new Map<string, string>();
  private readonly jobApplications = new Map<string, JobApplication>();
  private readonly scrapeBundles = new Map<string, ScrapeBundle>();
  private readonly matchAnalyses = new Map<string, MatchAnalysisResult>();
  private readonly documentContents = new Map<string, DocumentContent>();
  private readonly documents = new Map<string, GeneratedDocument[]>();
  private readonly events = new Map<string, JobApplicationEvent[]>();
  private readonly contacts = new Map<string, JobApplicationContact[]>();
  private readonly followUps = new Map<string, JobApplicationFollowUp[]>();

  async create(input: CreateJobApplicationInput): Promise<JobApplication> {
    const now = new Date();
    const jobApplication: JobApplication = {
      id: randomUUID(),
      profileId: input.profileId,
      sourceUrl: input.sourceUrl,
      status: input.sourceUrl ? "queued" : "completed",
      scrapeAttemptCount: 0,
      tracking: {
        companyName: input.companyName,
        roleTitle: input.roleTitle,
        roleType: input.roleType,
        jobUrl: input.jobUrl ?? input.sourceUrl,
        dateApplied: input.dateApplied,
        applicationStatus: input.applicationStatus ?? "saved",
        priority: input.priority,
        tags: input.tags ?? [],
        lastResponseAt: input.lastResponseAt,
        salaryMinAmount: input.salaryMinAmount,
        salaryMaxAmount: input.salaryMaxAmount,
        salaryCurrency: input.salaryCurrency,
        salaryPeriod: input.salaryPeriod,
        salaryType: input.salaryType,
        metadata: input.metadata ?? {},
      },
      createdAt: now,
      updatedAt: now,
    };

    this.jobApplications.set(jobApplication.id, jobApplication);
    await this.addEvent({
      jobApplicationId: jobApplication.id,
      type: "created",
      title: input.sourceUrl ? "LinkedIn job submitted" : "Application created",
      metadata: { sourceUrl: input.sourceUrl },
    });
    return jobApplication;
  }

  async findById(id: string): Promise<JobApplication | null> {
    return this.jobApplications.get(id) ?? null;
  }

  async claimNextScrapeJob(input: ClaimNextScrapeJobInput): Promise<JobApplication | null> {
    const now = input.now ?? new Date();
    const claimExpiresAt = new Date(now.getTime() + input.claimDurationMs);
    const claimable = [...this.jobApplications.values()]
      .filter((job) => job.profileId === input.profileId)
      .filter((job) => Boolean(job.sourceUrl))
      .filter((job) => isClaimable(job, now))
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())[0];

    if (!claimable) {
      return null;
    }

    const updated: JobApplication = {
      ...claimable,
      status: "scraping",
      failureReason: undefined,
      scrapeClaimedBy: input.claimedBy,
      scrapeClaimExpiresAt: claimExpiresAt,
      scrapeAttemptCount: claimable.scrapeAttemptCount + 1,
      nextScrapeAttemptAt: undefined,
      updatedAt: now,
    };

    this.jobApplications.set(updated.id, updated);
    return updated;
  }

  async renewScrapeClaim(
    id: string,
    input: {
      claimedBy: string;
      claimDurationMs: number;
      now?: Date;
    },
  ): Promise<JobApplication | null> {
    const existing = this.jobApplications.get(id);

    if (!existing || existing.scrapeClaimedBy !== input.claimedBy) {
      return null;
    }

    const now = input.now ?? new Date();
    const updated: JobApplication = {
      ...existing,
      scrapeClaimExpiresAt: new Date(now.getTime() + input.claimDurationMs),
      updatedAt: now,
    };

    this.jobApplications.set(id, updated);
    return updated;
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
    const existing = this.jobApplications.get(id);

    if (!existing || existing.scrapeClaimedBy !== input.claimedBy) {
      return null;
    }

    const now = input.now ?? new Date();
    const isFinalFailure = existing.scrapeAttemptCount >= input.maxAttempts;
    const updated: JobApplication = {
      ...existing,
      status: isFinalFailure ? "failed" : "queued",
      failureReason: input.reason,
      scrapeClaimedBy: undefined,
      scrapeClaimExpiresAt: undefined,
      nextScrapeAttemptAt: isFinalFailure ? undefined : new Date(now.getTime() + input.backoffMs),
      updatedAt: now,
    };

    this.jobApplications.set(id, updated);
    return updated;
  }

  async deleteById(id: string): Promise<void> {
    this.jobApplications.delete(id);
    this.scrapeBundles.delete(id);
    this.matchAnalyses.delete(id);
    this.documentContents.delete(id);
    this.documents.delete(id);
    this.events.delete(id);
    this.contacts.delete(id);
    this.followUps.delete(id);
    this.analysisAttempts.delete(id);
    this.documentGenerationAttempts.delete(id);
  }

  async listByProfileId(
    profileId: string,
    filter: ListJobApplicationsFilter = {},
  ): Promise<JobApplication[]> {
    return [...this.jobApplications.values()]
      .filter((job) => job.profileId === profileId)
      .filter((job) => matchesFilter(job, filter))
      .sort((left, right) => compareJobs(left, right, filter));
  }

  async listByStatus(status: JobApplicationStatus): Promise<JobApplication[]> {
    return [...this.jobApplications.values()].filter((job) => job.status === status);
  }

  async resetProcessing(id: string): Promise<JobApplication> {
    const existing = this.jobApplications.get(id);

    if (!existing) {
      throw new Error(`Job application ${id} was not found`);
    }

    const updated: JobApplication = {
      ...existing,
      status: "queued",
      failureReason: undefined,
      scrapeClaimedBy: undefined,
      scrapeClaimExpiresAt: undefined,
      scrapeAttemptCount: 0,
      nextScrapeAttemptAt: undefined,
      updatedAt: new Date(),
    };

    this.jobApplications.set(id, updated);
    this.scrapeBundles.delete(id);
    this.matchAnalyses.delete(id);
    this.documentContents.delete(id);
    this.documents.delete(id);
    this.analysisAttempts.delete(id);
    this.documentGenerationAttempts.delete(id);
    return updated;
  }

  async resetAnalysis(id: string): Promise<JobApplication> {
    const existing = this.jobApplications.get(id);

    if (!existing) {
      throw new Error(`Job application ${id} was not found`);
    }

    const updated: JobApplication = {
      ...existing,
      status: "scraped",
      failureReason: undefined,
      scrapeClaimedBy: undefined,
      scrapeClaimExpiresAt: undefined,
      nextScrapeAttemptAt: undefined,
      updatedAt: new Date(),
    };

    this.jobApplications.set(id, updated);
    this.matchAnalyses.delete(id);
    this.documentContents.delete(id);
    this.documents.delete(id);
    this.analysisAttempts.delete(id);
    this.documentGenerationAttempts.delete(id);
    return updated;
  }

  async beginAnalysis(id: string, attemptId: string): Promise<boolean> {
    const jobApplication = this.jobApplications.get(id);
    if (!jobApplication) return false;
    const currentAttempt = this.analysisAttempts.get(id);
    if (
      currentAttempt !== attemptId ||
      !["scraped", "analyzing", "failed"].includes(jobApplication.status)
    ) {
      return false;
    }
    this.jobApplications.set(id, { ...jobApplication, status: "analyzing" });
    return true;
  }

  async setAnalysisAttempt(id: string, attemptId: string): Promise<void> {
    const jobApplication = this.jobApplications.get(id);
    if (!jobApplication || jobApplication.status !== "scraped") {
      throw new Error(`Job application ${id} is not ready for analysis`);
    }
    this.analysisAttempts.set(id, attemptId);
  }

  async completeAnalysis(
    id: string,
    attemptId: string,
    result: MatchAnalysisResult,
    content: DocumentContent,
  ): Promise<boolean> {
    const jobApplication = this.jobApplications.get(id);
    if (
      !jobApplication ||
      jobApplication.status !== "analyzing" ||
      this.analysisAttempts.get(id) !== attemptId
    ) {
      return false;
    }
    this.matchAnalyses.set(id, structuredClone(result));
    this.documentContents.set(id, structuredClone(content));
    this.jobApplications.set(id, { ...jobApplication, status: "review_ready" });
    return true;
  }

  async failAnalysis(id: string, attemptId: string, reason: string): Promise<boolean> {
    const jobApplication = this.jobApplications.get(id);
    if (
      !jobApplication ||
      jobApplication.status !== "analyzing" ||
      this.analysisAttempts.get(id) !== attemptId
    ) {
      return false;
    }
    this.jobApplications.set(id, { ...jobApplication, status: "failed", failureReason: reason });
    return true;
  }

  async beginDocumentGeneration(
    id: string,
    attemptId: string,
  ): Promise<{ started: boolean; supersededAttemptId?: string }> {
    const jobApplication = this.jobApplications.get(id);
    if (
      !jobApplication ||
      !["review_ready", "generating_documents", "completed"].includes(jobApplication.status)
    ) {
      return { started: false };
    }
    const supersededAttemptId =
      jobApplication.status === "generating_documents"
        ? this.documentGenerationAttempts.get(id)
        : undefined;
    this.documentGenerationAttempts.set(id, attemptId);
    this.jobApplications.set(id, { ...jobApplication, status: "generating_documents" });
    return { started: true, ...(supersededAttemptId ? { supersededAttemptId } : {}) };
  }

  async completeDocumentGeneration(id: string, attemptId: string): Promise<boolean> {
    const jobApplication = this.jobApplications.get(id);
    if (
      !jobApplication ||
      jobApplication.status !== "generating_documents" ||
      this.documentGenerationAttempts.get(id) !== attemptId
    ) {
      return false;
    }
    this.jobApplications.set(id, { ...jobApplication, status: "completed" });
    return true;
  }

  async failDocumentGeneration(id: string, attemptId: string, reason: string): Promise<boolean> {
    const jobApplication = this.jobApplications.get(id);
    if (
      !jobApplication ||
      jobApplication.status !== "generating_documents" ||
      this.documentGenerationAttempts.get(id) !== attemptId
    ) {
      return false;
    }
    this.jobApplications.set(id, { ...jobApplication, status: "failed", failureReason: reason });
    return true;
  }

  async updateStatus(
    id: string,
    status: JobApplicationStatus,
    failureReason?: string,
  ): Promise<void> {
    const existing = this.jobApplications.get(id);

    if (!existing) {
      throw new Error(`Job application ${id} was not found`);
    }

    this.jobApplications.set(id, {
      ...existing,
      status,
      failureReason,
      scrapeClaimedBy: status === "failed" ? undefined : existing.scrapeClaimedBy,
      scrapeClaimExpiresAt: status === "failed" ? undefined : existing.scrapeClaimExpiresAt,
      nextScrapeAttemptAt: status === "failed" ? undefined : existing.nextScrapeAttemptAt,
      updatedAt: new Date(),
    });
  }

  async updateTracking(
    id: string,
    input: UpdateJobApplicationTrackingInput,
  ): Promise<JobApplication> {
    const existing = this.jobApplications.get(id);

    if (!existing) {
      throw new Error(`Job application ${id} was not found`);
    }

    const updated: JobApplication = {
      ...existing,
      tracking: {
        ...existing.tracking,
        ...input,
        lastResponseAt:
          input.lastResponseAt === undefined
            ? existing.tracking.lastResponseAt
            : (input.lastResponseAt ?? undefined),
        priority:
          input.priority === undefined ? existing.tracking.priority : (input.priority ?? undefined),
        salaryMinAmount:
          input.salaryMinAmount === undefined
            ? existing.tracking.salaryMinAmount
            : (input.salaryMinAmount ?? undefined),
        salaryMaxAmount:
          input.salaryMaxAmount === undefined
            ? existing.tracking.salaryMaxAmount
            : (input.salaryMaxAmount ?? undefined),
        salaryCurrency:
          input.salaryCurrency === undefined
            ? existing.tracking.salaryCurrency
            : (input.salaryCurrency ?? undefined),
        salaryPeriod:
          input.salaryPeriod === undefined
            ? existing.tracking.salaryPeriod
            : (input.salaryPeriod ?? undefined),
        salaryType:
          input.salaryType === undefined
            ? existing.tracking.salaryType
            : (input.salaryType ?? undefined),
      },
      updatedAt: new Date(),
    };

    this.jobApplications.set(id, updated);
    return updated;
  }

  async saveScrapeBundle(id: string, scrape: ScrapeBundle): Promise<void> {
    this.scrapeBundles.set(id, scrape);
    const existing = this.jobApplications.get(id);

    if (existing) {
      this.jobApplications.set(id, {
        ...existing,
        scrapeClaimedBy: undefined,
        scrapeClaimExpiresAt: undefined,
        scrapeAttemptCount: 0,
        nextScrapeAttemptAt: undefined,
        updatedAt: new Date(),
      });
      await this.updateTracking(id, {
        companyName: existing.tracking.companyName ?? scrape.job.companyName,
        roleTitle: existing.tracking.roleTitle ?? scrape.job.title,
        jobUrl: existing.tracking.jobUrl ?? existing.sourceUrl,
      });
    }
  }

  async getScrapeBundle(id: string): Promise<ScrapeBundle | null> {
    return this.scrapeBundles.get(id) ?? null;
  }

  async getCompanyLogoFileId(id: string): Promise<string | null> {
    return this.scrapeBundles.get(id)?.companyLinkedIn?.logoFileId ?? null;
  }

  async saveMatchAnalysis(id: string, result: MatchAnalysisResult): Promise<void> {
    this.matchAnalyses.set(id, result);
  }

  async getMatchAnalysis(id: string): Promise<MatchAnalysisResult | null> {
    return this.matchAnalyses.get(id) ?? null;
  }

  async saveDocumentContent(id: string, content: DocumentContent): Promise<void> {
    this.documentContents.set(id, structuredClone(content));
  }

  async getDocumentContent(id: string): Promise<DocumentContent | null> {
    const content = this.documentContents.get(id);
    return content ? structuredClone(content) : null;
  }

  async addEvent(input: CreateJobApplicationEventInput): Promise<JobApplicationEvent> {
    const event: JobApplicationEvent = {
      id: randomUUID(),
      jobApplicationId: input.jobApplicationId,
      type: input.type,
      title: input.title,
      body: input.body,
      occurredAt: input.occurredAt ?? new Date(),
      metadata: input.metadata ?? {},
      createdAt: new Date(),
    };
    const current = this.events.get(input.jobApplicationId) ?? [];

    this.events.set(input.jobApplicationId, [...current, event]);
    return event;
  }

  async listEvents(jobApplicationId: string): Promise<JobApplicationEvent[]> {
    return (this.events.get(jobApplicationId) ?? [])
      .map((event, index) => ({ event, index }))
      .sort(
        (left, right) =>
          right.event.occurredAt.getTime() - left.event.occurredAt.getTime() ||
          right.event.createdAt.getTime() - left.event.createdAt.getTime() ||
          right.index - left.index,
      )
      .map(({ event }) => event);
  }

  async createContact(input: CreateJobApplicationContactInput): Promise<JobApplicationContact> {
    const contact: JobApplicationContact = {
      id: randomUUID(),
      ...input,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const current = this.contacts.get(input.jobApplicationId) ?? [];

    this.contacts.set(input.jobApplicationId, [...current, contact]);
    return contact;
  }

  async findContactById(id: string): Promise<JobApplicationContact | null> {
    return [...this.contacts.values()].flat().find((contact) => contact.id === id) ?? null;
  }

  async listContacts(jobApplicationId: string): Promise<JobApplicationContact[]> {
    return [...(this.contacts.get(jobApplicationId) ?? [])].sort(
      (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
    );
  }

  async updateContact(
    id: string,
    input: UpdateJobApplicationContactInput,
  ): Promise<JobApplicationContact> {
    const existing = await this.findContactById(id);

    if (!existing) {
      throw new Error(`Job application contact ${id} was not found`);
    }

    const updated: JobApplicationContact = {
      ...existing,
      ...input,
      role: input.role === undefined ? existing.role : (input.role ?? undefined),
      email: input.email === undefined ? existing.email : (input.email ?? undefined),
      phone: input.phone === undefined ? existing.phone : (input.phone ?? undefined),
      linkedInUrl:
        input.linkedInUrl === undefined ? existing.linkedInUrl : (input.linkedInUrl ?? undefined),
      notes: input.notes === undefined ? existing.notes : (input.notes ?? undefined),
      updatedAt: new Date(),
    };

    this.contacts.set(
      existing.jobApplicationId,
      (this.contacts.get(existing.jobApplicationId) ?? []).map((contact) =>
        contact.id === id ? updated : contact,
      ),
    );
    return updated;
  }

  async deleteContact(id: string): Promise<void> {
    const existing = await this.findContactById(id);

    if (!existing) {
      return;
    }

    this.contacts.set(
      existing.jobApplicationId,
      (this.contacts.get(existing.jobApplicationId) ?? []).filter((contact) => contact.id !== id),
    );
  }

  async createFollowUp(input: CreateJobApplicationFollowUpInput): Promise<JobApplicationFollowUp> {
    const followUp: JobApplicationFollowUp = {
      id: randomUUID(),
      jobApplicationId: input.jobApplicationId,
      profileId: input.profileId,
      title: input.title,
      description: input.description,
      scheduledAt: input.scheduledAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const current = this.followUps.get(input.jobApplicationId) ?? [];

    this.followUps.set(input.jobApplicationId, [...current, followUp]);
    return followUp;
  }

  async findFollowUpById(id: string): Promise<JobApplicationFollowUp | null> {
    return [...this.followUps.values()].flat().find((followUp) => followUp.id === id) ?? null;
  }

  async listFollowUps(jobApplicationId: string): Promise<JobApplicationFollowUp[]> {
    return [...(this.followUps.get(jobApplicationId) ?? [])].sort(
      (left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime(),
    );
  }

  async updateFollowUp(
    id: string,
    input: UpdateJobApplicationFollowUpInput,
  ): Promise<JobApplicationFollowUp> {
    const existing = await this.findFollowUpById(id);

    if (!existing) {
      throw new Error(`Job application follow-up ${id} was not found`);
    }

    const updated: JobApplicationFollowUp = {
      ...existing,
      title: input.title ?? existing.title,
      description:
        input.description === undefined ? existing.description : (input.description ?? undefined),
      scheduledAt: input.scheduledAt ?? existing.scheduledAt,
      updatedAt: new Date(),
    };

    this.followUps.set(
      existing.jobApplicationId,
      (this.followUps.get(existing.jobApplicationId) ?? []).map((followUp) =>
        followUp.id === id ? updated : followUp,
      ),
    );
    return updated;
  }

  async deleteFollowUp(id: string): Promise<void> {
    const existing = await this.findFollowUpById(id);

    if (!existing) {
      return;
    }

    this.followUps.set(
      existing.jobApplicationId,
      (this.followUps.get(existing.jobApplicationId) ?? []).filter(
        (followUp) => followUp.id !== id,
      ),
    );
  }

  async attachGeneratedDocument(input: AttachGeneratedDocumentInput): Promise<GeneratedDocument> {
    const current = this.documents.get(input.jobApplicationId) ?? [];
    const existing = current.find(
      (document) => document.kind === input.kind && document.format === input.format,
    );
    const document: GeneratedDocument = {
      id: existing?.id ?? randomUUID(),
      ...input,
      createdAt: new Date(),
    };
    const next = existing
      ? current.map((item) => (item.id === existing.id ? document : item))
      : [...current, document];

    this.documents.set(input.jobApplicationId, next);
    return document;
  }

  async listGeneratedDocuments(jobApplicationId: string): Promise<GeneratedDocument[]> {
    return this.documents.get(jobApplicationId) ?? [];
  }
}

function isClaimable(job: JobApplication, now: Date): boolean {
  if (job.status === "queued") {
    return (
      job.nextScrapeAttemptAt === undefined || job.nextScrapeAttemptAt.getTime() <= now.getTime()
    );
  }

  return (
    job.status === "scraping" &&
    job.scrapeClaimExpiresAt !== undefined &&
    job.scrapeClaimExpiresAt.getTime() <= now.getTime()
  );
}

function matchesFilter(job: JobApplication, filter: ListJobApplicationsFilter): boolean {
  if (filter.applicationStatus && job.tracking.applicationStatus !== filter.applicationStatus) {
    return false;
  }

  if (filter.processingStatus && job.status !== filter.processingStatus) {
    return false;
  }

  if (filter.priority && job.tracking.priority !== filter.priority) {
    return false;
  }

  if (filter.roleType && job.tracking.roleType !== filter.roleType) {
    return false;
  }

  if (filter.tag && !job.tracking.tags.includes(filter.tag)) {
    return false;
  }

  if (
    filter.dateFrom &&
    (!job.tracking.dateApplied || job.tracking.dateApplied < filter.dateFrom)
  ) {
    return false;
  }

  if (filter.dateTo && (!job.tracking.dateApplied || job.tracking.dateApplied > filter.dateTo)) {
    return false;
  }

  if (filter.company && !contains(job.tracking.companyName, filter.company)) {
    return false;
  }

  if (filter.role && !contains(job.tracking.roleTitle, filter.role)) {
    return false;
  }

  if (filter.search) {
    const searchable = [
      job.tracking.companyName,
      job.tracking.roleTitle,
      job.tracking.roleType,
      ...job.tracking.tags,
    ].join(" ");

    if (!contains(searchable, filter.search)) {
      return false;
    }
  }

  return true;
}

function compareJobs(
  left: JobApplication,
  right: JobApplication,
  filter: ListJobApplicationsFilter,
): number {
  const sortBy = filter.sortBy ?? "updatedAt";
  const direction = filter.sortDirection ?? "desc";
  const modifier = direction === "asc" ? 1 : -1;
  const leftValue = sortableValue(left, sortBy);
  const rightValue = sortableValue(right, sortBy);

  if (leftValue < rightValue) {
    return -1 * modifier;
  }

  if (leftValue > rightValue) {
    return 1 * modifier;
  }

  return 0;
}

function sortableValue(
  job: JobApplication,
  sortBy: NonNullable<ListJobApplicationsFilter["sortBy"]>,
) {
  if (sortBy === "updatedAt") {
    return job.updatedAt.toISOString();
  }

  return job.tracking[sortBy] ?? "";
}

function contains(value: string | undefined, query: string): boolean {
  return (value ?? "").toLowerCase().includes(query.toLowerCase());
}
