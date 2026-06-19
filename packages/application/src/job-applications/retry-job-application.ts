import type {
  FileStorage,
  JobApplication,
  JobApplicationQueue,
  JobApplicationRepository,
} from "@link2cv/domain";

export class RetryJobApplicationUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly queue: JobApplicationQueue,
    private readonly storage: FileStorage,
  ) {}

  async execute(jobApplicationId: string): Promise<JobApplication | null> {
    const jobApplication = await this.jobApplications.findById(jobApplicationId);

    if (!jobApplication) {
      return null;
    }

    if (jobApplication.status !== "failed") {
      throw new Error("Only failed job applications can be retried");
    }

    if (!jobApplication.sourceUrl) {
      throw new Error("Job application does not have a source URL to retry");
    }

    const [documents, companyLogoFileId] = await Promise.all([
      this.jobApplications.listGeneratedDocuments(jobApplicationId),
      this.jobApplications.getCompanyLogoFileId(jobApplicationId),
    ]);
    const fileIds = new Set(documents.map((document) => document.fileId));

    if (companyLogoFileId) {
      fileIds.add(companyLogoFileId);
    }

    const reset = await this.jobApplications.resetProcessing(jobApplicationId);
    await this.jobApplications.addEvent({
      jobApplicationId,
      type: "processing",
      title: "Retry requested",
    });
    await Promise.allSettled([...fileIds].map((fileId) => this.storage.delete(fileId)));

    try {
      await this.queue.restart({ jobApplicationId });
      return reset;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to enqueue retry";
      await this.jobApplications.updateStatus(jobApplicationId, "failed", message);
      await this.jobApplications.addEvent({
        jobApplicationId,
        type: "processing",
        title: "Retry enqueue failed",
        body: message,
      });
      throw error;
    }
  }
}
