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
import type { CreateJobApplicationInput } from "@link2cv/domain";
import type { JobApplicationStatus } from "@link2cv/domain";
import { randomUUID } from "node:crypto";

export class InMemoryJobApplicationRepository implements JobApplicationRepository {
  private readonly jobApplications = new Map<string, JobApplication>();
  private readonly scrapeBundles = new Map<string, ScrapeBundle>();
  private readonly matchAnalyses = new Map<string, MatchAnalysisResult>();
  private readonly documents = new Map<string, GeneratedDocument[]>();
  private readonly events = new Map<string, JobApplicationEvent[]>();
  private readonly contacts = new Map<string, JobApplicationContact[]>();
  private readonly interviews = new Map<string, JobApplicationInterview[]>();

  async create(input: CreateJobApplicationInput): Promise<JobApplication> {
    const now = new Date();
    const jobApplication: JobApplication = {
      id: randomUUID(),
      profileId: input.profileId,
      sourceUrl: input.sourceUrl,
      status: input.sourceUrl ? "queued" : "completed",
      tracking: {
        companyName: input.companyName,
        roleTitle: input.roleTitle,
        roleType: input.roleType,
        jobUrl: input.jobUrl ?? input.sourceUrl,
        dateApplied: input.dateApplied,
        applicationStatus: input.applicationStatus ?? "applied",
        priority: input.priority ?? "medium",
        tags: input.tags ?? [],
        nextFollowUpAt: input.nextFollowUpAt,
        lastResponseAt: input.lastResponseAt,
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
        nextFollowUpAt:
          input.nextFollowUpAt === undefined
            ? existing.tracking.nextFollowUpAt
            : (input.nextFollowUpAt ?? undefined),
        lastResponseAt:
          input.lastResponseAt === undefined
            ? existing.tracking.lastResponseAt
            : (input.lastResponseAt ?? undefined),
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

  async saveMatchAnalysis(id: string, result: MatchAnalysisResult): Promise<void> {
    this.matchAnalyses.set(id, result);
  }

  async getMatchAnalysis(id: string): Promise<MatchAnalysisResult | null> {
    return this.matchAnalyses.get(id) ?? null;
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
    return (this.events.get(jobApplicationId) ?? []).sort(
      (left, right) => right.occurredAt.getTime() - left.occurredAt.getTime(),
    );
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

  async createInterview(
    input: CreateJobApplicationInterviewInput,
  ): Promise<JobApplicationInterview> {
    const interview: JobApplicationInterview = {
      id: randomUUID(),
      jobApplicationId: input.jobApplicationId,
      title: input.title,
      type: input.type,
      scheduledAt: input.scheduledAt,
      status: input.status ?? "upcoming",
      notes: input.notes,
      prepNotes: input.prepNotes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const current = this.interviews.get(input.jobApplicationId) ?? [];

    this.interviews.set(input.jobApplicationId, [...current, interview]);
    return interview;
  }

  async findInterviewById(id: string): Promise<JobApplicationInterview | null> {
    return [...this.interviews.values()].flat().find((interview) => interview.id === id) ?? null;
  }

  async listInterviews(jobApplicationId: string): Promise<JobApplicationInterview[]> {
    return [...(this.interviews.get(jobApplicationId) ?? [])].sort(
      (left, right) =>
        left.scheduledAt.getTime() - right.scheduledAt.getTime() ||
        left.createdAt.getTime() - right.createdAt.getTime(),
    );
  }

  async updateInterview(
    id: string,
    input: UpdateJobApplicationInterviewInput,
  ): Promise<JobApplicationInterview> {
    const existing = await this.findInterviewById(id);

    if (!existing) {
      throw new Error(`Job application interview ${id} was not found`);
    }

    const updated: JobApplicationInterview = {
      ...existing,
      ...input,
      type: input.type === undefined ? existing.type : (input.type ?? undefined),
      notes: input.notes === undefined ? existing.notes : (input.notes ?? undefined),
      prepNotes:
        input.prepNotes === undefined ? existing.prepNotes : (input.prepNotes ?? undefined),
      updatedAt: new Date(),
    };

    this.interviews.set(
      existing.jobApplicationId,
      (this.interviews.get(existing.jobApplicationId) ?? []).map((interview) =>
        interview.id === id ? updated : interview,
      ),
    );
    return updated;
  }

  async deleteInterview(id: string): Promise<void> {
    const existing = await this.findInterviewById(id);

    if (!existing) {
      return;
    }

    this.interviews.set(
      existing.jobApplicationId,
      (this.interviews.get(existing.jobApplicationId) ?? []).filter(
        (interview) => interview.id !== id,
      ),
    );
  }

  async attachGeneratedDocument(input: AttachGeneratedDocumentInput): Promise<GeneratedDocument> {
    const current = this.documents.get(input.jobApplicationId) ?? [];
    const existing = current.find((document) => document.kind === input.kind);
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

function matchesFilter(job: JobApplication, filter: ListJobApplicationsFilter): boolean {
  if (filter.applicationStatus && job.tracking.applicationStatus !== filter.applicationStatus) {
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
