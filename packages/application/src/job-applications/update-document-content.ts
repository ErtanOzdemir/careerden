import type { DocumentContent, JobApplicationRepository } from "@link2cv/domain";

export class UpdateDocumentContentUseCase {
  constructor(private readonly jobApplications: JobApplicationRepository) {}

  async execute(
    jobApplicationId: string,
    documentContent: DocumentContent,
  ): Promise<DocumentContent | null> {
    const jobApplication = await this.jobApplications.findById(jobApplicationId);

    if (!jobApplication) {
      return null;
    }

    await this.jobApplications.saveDocumentContent(jobApplicationId, documentContent);
    return documentContent;
  }
}
