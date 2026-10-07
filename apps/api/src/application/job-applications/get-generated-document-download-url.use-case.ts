import type {
  FileStorage,
  JobApplicationRepository,
  UserProfileAccessRepository,
} from "@careerden/domain";
import { ApplicationError } from "@careerden/application";
import { getAccessibleJobApplication } from "@careerden/application";

export class GetGeneratedDocumentDownloadUrlUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccessRepository,
    private readonly storage: FileStorage,
  ) {}
  async execute(jobApplicationId: string, documentId: string, userId: string): Promise<string> {
    await getAccessibleJobApplication(
      this.jobApplications,
      this.profiles,
      jobApplicationId,
      userId,
    );
    const documents = await this.jobApplications.listGeneratedDocuments(jobApplicationId);
    const document = documents.find((item) => item.id === documentId);
    if (!document) throw new ApplicationError("not_found", "Document not found");
    return this.storage.getSignedUrl(document.fileId);
  }
}
