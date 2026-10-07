import type {
  ApplicationPackPreferences,
  DocumentContent,
  JobApplicationRepository,
  UserProfileAccountRepository,
} from "@careerden/domain";
import { normalizeApplicationPackPreferences } from "@careerden/domain";
import { ApplicationError } from "@careerden/application";
import type { GenerateDocumentsUseCase, PreviewGeneratedDocuments } from "@careerden/application";
import { getAccessibleJobApplication } from "@careerden/application";

export interface PreviewApplicationPackInput {
  documentContent?: DocumentContent;
  preferences?: ApplicationPackPreferences;
}

/**
 * Renders the CV/cover-letter HTML for on-screen review from draft (possibly unsaved) content and
 * preferences, without writing to storage or the database — the synchronous counterpart to the
 * queued `GenerateJobApplicationDocumentsUseCase`.
 */
export class PreviewApplicationPackUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccountRepository,
    private readonly documentGeneration: GenerateDocumentsUseCase,
  ) {}

  async execute(
    jobApplicationId: string,
    userId: string,
    input: PreviewApplicationPackInput,
  ): Promise<PreviewGeneratedDocuments> {
    const jobApplication = await getAccessibleJobApplication(
      this.jobApplications,
      this.profiles,
      jobApplicationId,
      userId,
    );
    const profile = await this.profiles.findById(jobApplication.profileId);
    if (!profile) throw new ApplicationError("not_found", "Profile not found");

    const analysis = await this.jobApplications.getMatchAnalysis(jobApplicationId);
    if (!analysis) {
      throw new ApplicationError(
        "validation",
        "Application pack preview requires completed AI analysis",
      );
    }

    const previewJobApplication = input.preferences
      ? {
          ...jobApplication,
          applicationPackPreferences: normalizeApplicationPackPreferences(input.preferences),
        }
      : jobApplication;

    return this.documentGeneration.preview({
      jobApplicationId,
      jobApplication: previewJobApplication,
      profile,
      analysis,
      ...(input.documentContent ? { documentContent: input.documentContent } : {}),
    });
  }
}
