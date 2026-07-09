import type {
  AttachGeneratedDocumentInput,
  CreateJobApplicationContactInput,
  CreateJobApplicationEventInput,
  CreateJobApplicationFollowUpInput,
  CreateJobApplicationInput,
  DocumentContent,
  JobApplicationChangePublisher,
  JobApplicationRepository,
  JobApplicationStatus,
  ListJobApplicationsFilter,
  MatchAnalysisResult,
  ScrapeBundle,
  UpdateJobApplicationContactInput,
  UpdateJobApplicationFollowUpInput,
  UpdateJobApplicationTrackingInput,
} from "@link2cv/domain";

export class PublishingJobApplicationRepository implements JobApplicationRepository {
  constructor(
    private readonly repository: JobApplicationRepository,
    private readonly publisher: JobApplicationChangePublisher,
  ) {}

  async create(input: CreateJobApplicationInput) {
    const application = await this.repository.create(input);
    await this.publishChanged(application.id, application.profileId);
    return application;
  }

  async claimNextScrapeJob(input: Parameters<JobApplicationRepository["claimNextScrapeJob"]>[0]) {
    const application = await this.repository.claimNextScrapeJob(input);

    if (application) {
      await this.publishChanged(application.id, application.profileId);
    }

    return application;
  }

  async renewScrapeClaim(
    inputId: string,
    input: Parameters<JobApplicationRepository["renewScrapeClaim"]>[1],
  ) {
    const application = await this.repository.renewScrapeClaim(inputId, input);

    if (application) {
      await this.publishChanged(application.id, application.profileId);
    }

    return application;
  }

  async recordScrapeFailure(
    inputId: string,
    input: Parameters<JobApplicationRepository["recordScrapeFailure"]>[1],
  ) {
    const application = await this.repository.recordScrapeFailure(inputId, input);

    if (application) {
      await this.publishChanged(application.id, application.profileId);
    }

    return application;
  }

  async deleteById(id: string): Promise<void> {
    const application = await this.repository.findById(id);
    await this.repository.deleteById(id);

    if (application) {
      await this.publish({
        type: "application.deleted",
        applicationId: id,
        profileId: application.profileId,
        occurredAt: new Date().toISOString(),
      });
    }
  }

  findById(id: string) {
    return this.repository.findById(id);
  }

  listByProfileId(profileId: string, filter?: ListJobApplicationsFilter) {
    return this.repository.listByProfileId(profileId, filter);
  }

  listByStatus(status: JobApplicationStatus) {
    return this.repository.listByStatus(status);
  }

  async resetProcessing(id: string) {
    const application = await this.repository.resetProcessing(id);
    await this.publishChanged(id, application.profileId);
    return application;
  }

  async resetAnalysis(id: string) {
    const application = await this.repository.resetAnalysis(id);
    await this.publishChanged(id, application.profileId);
    return application;
  }

  async updateStatus(id: string, status: JobApplicationStatus, failureReason?: string) {
    await this.repository.updateStatus(id, status, failureReason);
    await this.publishForApplication(id);
  }

  async updateTracking(id: string, input: UpdateJobApplicationTrackingInput) {
    const application = await this.repository.updateTracking(id, input);
    await this.publishChanged(id, application.profileId);
    return application;
  }

  async saveScrapeBundle(id: string, scrape: ScrapeBundle) {
    await this.repository.saveScrapeBundle(id, scrape);
    await this.publishForApplication(id);
  }

  getScrapeBundle(id: string) {
    return this.repository.getScrapeBundle(id);
  }

  getCompanyLogoFileId(id: string) {
    return this.repository.getCompanyLogoFileId(id);
  }

  async saveMatchAnalysis(id: string, result: MatchAnalysisResult) {
    await this.repository.saveMatchAnalysis(id, result);
    await this.publishForApplication(id);
  }

  getMatchAnalysis(id: string) {
    return this.repository.getMatchAnalysis(id);
  }

  async saveDocumentContent(id: string, content: DocumentContent) {
    await this.repository.saveDocumentContent(id, content);
    await this.publishForApplication(id);
  }

  getDocumentContent(id: string) {
    return this.repository.getDocumentContent(id);
  }

  async addEvent(input: CreateJobApplicationEventInput) {
    const event = await this.repository.addEvent(input);
    await this.publishForApplication(input.jobApplicationId);
    return event;
  }

  listEvents(jobApplicationId: string) {
    return this.repository.listEvents(jobApplicationId);
  }

  async createContact(input: CreateJobApplicationContactInput) {
    const contact = await this.repository.createContact(input);
    await this.publishForApplication(input.jobApplicationId);
    return contact;
  }

  findContactById(id: string) {
    return this.repository.findContactById(id);
  }

  listContacts(jobApplicationId: string) {
    return this.repository.listContacts(jobApplicationId);
  }

  async updateContact(id: string, input: UpdateJobApplicationContactInput) {
    const contact = await this.repository.updateContact(id, input);
    await this.publishForApplication(contact.jobApplicationId);
    return contact;
  }

  async deleteContact(id: string) {
    const contact = await this.repository.findContactById(id);
    await this.repository.deleteContact(id);

    if (contact) {
      await this.publishForApplication(contact.jobApplicationId);
    }
  }

  async createFollowUp(input: CreateJobApplicationFollowUpInput) {
    const followUp = await this.repository.createFollowUp(input);
    await this.publishForApplication(input.jobApplicationId);
    return followUp;
  }

  findFollowUpById(id: string) {
    return this.repository.findFollowUpById(id);
  }

  listFollowUps(jobApplicationId: string) {
    return this.repository.listFollowUps(jobApplicationId);
  }

  async updateFollowUp(id: string, input: UpdateJobApplicationFollowUpInput) {
    const followUp = await this.repository.updateFollowUp(id, input);
    await this.publishForApplication(followUp.jobApplicationId);
    return followUp;
  }

  async deleteFollowUp(id: string) {
    const followUp = await this.repository.findFollowUpById(id);
    await this.repository.deleteFollowUp(id);

    if (followUp) {
      await this.publishForApplication(followUp.jobApplicationId);
    }
  }

  async attachGeneratedDocument(input: AttachGeneratedDocumentInput) {
    const document = await this.repository.attachGeneratedDocument(input);
    await this.publishForApplication(input.jobApplicationId);
    return document;
  }

  listGeneratedDocuments(jobApplicationId: string) {
    return this.repository.listGeneratedDocuments(jobApplicationId);
  }

  private async publishForApplication(applicationId: string): Promise<void> {
    const application = await this.repository.findById(applicationId);

    if (application) {
      await this.publishChanged(applicationId, application.profileId);
    }
  }

  private publishChanged(applicationId: string, profileId: string): Promise<void> {
    return this.publish({
      type: "application.changed",
      applicationId,
      profileId,
      occurredAt: new Date().toISOString(),
    });
  }

  private async publish(change: Parameters<JobApplicationChangePublisher["publish"]>[0]) {
    try {
      await this.publisher.publish(change);
    } catch (error) {
      console.error("Failed to publish job application realtime change", error);
    }
  }
}
