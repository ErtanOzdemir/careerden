import type {
  DocumentContent,
  JobApplicationRepository,
  UserProfileAccessRepository,
} from "@link2cv/domain";
import { getAccessibleJobApplication } from "./job-application-access.js";
import { JobApplicationChangeNotifier } from "./job-application-change.notifier.js";

export class UpdateDocumentContentUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccessRepository,
    private readonly changes: JobApplicationChangeNotifier,
  ) {}

  async execute(
    jobApplicationId: string,
    userId: string,
    documentContent: DocumentContent,
  ): Promise<DocumentContent> {
    const jobApplication = await getAccessibleJobApplication(
      this.jobApplications,
      this.profiles,
      jobApplicationId,
      userId,
    );
    await this.jobApplications.saveDocumentContent(jobApplicationId, documentContent);
    await this.changes.changed(jobApplication.id, jobApplication.profileId);
    return documentContent;
  }
}
