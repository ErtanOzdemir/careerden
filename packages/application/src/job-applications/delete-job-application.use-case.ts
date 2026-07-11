import type {
  FileStorage,
  JobApplicationRepository,
  UserProfileAccessRepository,
} from "@link2cv/domain";
import { getAccessibleJobApplication } from "./job-application-access.js";
import { JobApplicationChangeNotifier } from "./job-application-change.notifier.js";

export class DeleteJobApplicationUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccessRepository,
    private readonly storage: FileStorage,
    private readonly changes: JobApplicationChangeNotifier,
  ) {}

  async execute(jobApplicationId: string, userId: string): Promise<void> {
    const jobApplication = await getAccessibleJobApplication(
      this.jobApplications,
      this.profiles,
      jobApplicationId,
      userId,
    );

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
    await this.changes.deleted(jobApplication.id, jobApplication.profileId);
  }
}
