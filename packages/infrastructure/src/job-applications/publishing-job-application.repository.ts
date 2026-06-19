import type {
  AttachGeneratedDocumentInput,
  CreateJobApplicationContactInput,
  CreateJobApplicationEventInput,
  CreateJobApplicationInput,
  CreateJobApplicationInterviewInput,
  JobApplicationChangePublisher,
  JobApplicationRepository,
  JobApplicationStatus,
  ListJobApplicationsFilter,
  MatchAnalysisResult,
  ScrapeBundle,
  UpdateJobApplicationContactInput,
  UpdateJobApplicationInterviewInput,
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

  async createInterview(input: CreateJobApplicationInterviewInput) {
    const interview = await this.repository.createInterview(input);
    await this.publishForApplication(input.jobApplicationId);
    return interview;
  }

  findInterviewById(id: string) {
    return this.repository.findInterviewById(id);
  }

  listInterviews(jobApplicationId: string) {
    return this.repository.listInterviews(jobApplicationId);
  }

  async updateInterview(id: string, input: UpdateJobApplicationInterviewInput) {
    const interview = await this.repository.updateInterview(id, input);
    await this.publishForApplication(interview.jobApplicationId);
    return interview;
  }

  async deleteInterview(id: string) {
    const interview = await this.repository.findInterviewById(id);
    await this.repository.deleteInterview(id);

    if (interview) {
      await this.publishForApplication(interview.jobApplicationId);
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
