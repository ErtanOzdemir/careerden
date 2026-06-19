import type { FileStorage, JobApplicationRepository } from "@link2cv/domain";

export class DeleteJobApplicationUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly storage: FileStorage,
  ) {}

  async execute(jobApplicationId: string): Promise<boolean> {
    const jobApplication = await this.jobApplications.findById(jobApplicationId);

    if (!jobApplication) {
      return false;
    }

    const [documents, companyLogoFileId] = await Promise.all([
      this.jobApplications.listGeneratedDocuments(jobApplicationId),
      this.jobApplications.getCompanyLogoFileId(jobApplicationId),
    ]);
    const fileIds = new Set(documents.map((document) => document.fileId));

    if (companyLogoFileId) {
      fileIds.add(companyLogoFileId);
    }

    await this.jobApplications.deleteById(jobApplicationId);
    await Promise.allSettled([...fileIds].map((fileId) => this.storage.delete(fileId)));

    return true;
  }
}
