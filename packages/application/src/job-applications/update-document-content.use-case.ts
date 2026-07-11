import type {
  DocumentContent,
  JobApplicationRepository,
  UserProfileAccessRepository,
} from "@link2cv/domain";
import { getAccessibleJobApplication } from "./job-application-access.js";

export class UpdateDocumentContentUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccessRepository,
  ) {}

  async execute(
    jobApplicationId: string,
    userId: string,
    documentContent: DocumentContent,
  ): Promise<DocumentContent> {
    await getAccessibleJobApplication(
      this.jobApplications,
      this.profiles,
      jobApplicationId,
      userId,
    );
    await this.jobApplications.saveDocumentContent(jobApplicationId, documentContent);
    return documentContent;
  }
}
