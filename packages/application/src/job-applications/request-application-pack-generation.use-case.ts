import type {
  ApplicationPackPreferences,
  DocumentContent,
  DocumentTemplateKind,
  PersistenceUnitOfWork,
  UserProfileRepository,
} from "@careerden/domain";
import { normalizeApplicationPackPreferences } from "@careerden/domain";
import { ApplicationError } from "../application-error.js";
import { hasValidCoverLetterContentMapping } from "../profiles/document-template-mapping.js";
import { enqueueApplicationPackGeneration } from "./enqueue-application-pack-generation.js";
import { getAccessibleJobApplication } from "./job-application-access.js";

export interface RequestApplicationPackGenerationInput {
  jobApplicationId: string;
  userId: string;
  documentContent?: DocumentContent;
  preferences?: ApplicationPackPreferences;
}

export interface RequestApplicationPackGenerationResult {
  generationAttemptId: string;
}

export class RequestApplicationPackGenerationUseCase {
  constructor(private readonly unitOfWork: PersistenceUnitOfWork) {}

  async execute(
    input: RequestApplicationPackGenerationInput,
  ): Promise<RequestApplicationPackGenerationResult> {
    return this.unitOfWork.execute(
      async ({ jobApplications, jobApplicationChanges, outbox, profiles }) => {
        let jobApplication = await getAccessibleJobApplication(
          jobApplications,
          profiles,
          input.jobApplicationId,
          input.userId,
        );
        const profile = await profiles.findById(jobApplication.profileId);

        if (!profile) throw new ApplicationError("not_found", "Profile not found");
        if (!(await jobApplications.getMatchAnalysis(jobApplication.id))) {
          throw new ApplicationError(
            "validation",
            "Application pack generation requires completed AI analysis",
          );
        }

        const preferences = normalizeApplicationPackPreferences(
          input.preferences ?? jobApplication.applicationPackPreferences,
        );
        await validateApplicationPackPreferences(profiles, profile.id, preferences);

        if (input.documentContent) {
          await jobApplications.saveDocumentContent(jobApplication.id, input.documentContent);
        }
        if (input.preferences) {
          jobApplication = await jobApplications.updateApplicationPackPreferences(
            jobApplication.id,
            preferences,
          );
        }

        const generationAttemptId = await enqueueApplicationPackGeneration({
          jobApplications,
          outbox,
          jobApplication,
        });
        if (!generationAttemptId) {
          throw new ApplicationError(
            "validation",
            "Application pack generation is not available in the current processing state",
          );
        }

        await jobApplicationChanges.changed(jobApplication.id, jobApplication.profileId);
        return { generationAttemptId };
      },
    );
  }
}

export async function validateApplicationPackPreferences(
  profiles: Pick<UserProfileRepository, "findDocumentTemplateById">,
  profileId: string,
  preferences: ApplicationPackPreferences,
): Promise<void> {
  await Promise.all([
    validateTemplate(profiles, profileId, preferences.cvTemplateId, "cv"),
    validateTemplate(profiles, profileId, preferences.coverLetterTemplateId, "cover_letter"),
  ]);
}

async function validateTemplate(
  profiles: Pick<UserProfileRepository, "findDocumentTemplateById">,
  profileId: string,
  templateId: string | undefined,
  kind: DocumentTemplateKind,
): Promise<void> {
  if (!templateId) return;

  const template = await profiles.findDocumentTemplateById(templateId);
  if (!template || template.profileId !== profileId || template.kind !== kind) {
    throw new ApplicationError("validation", `Selected ${templateLabel(kind)} is not available`);
  }
  if (kind === "cover_letter" && !hasValidCoverLetterContentMapping(template)) {
    throw new ApplicationError(
      "validation",
      "Selected cover letter template needs a valid content mapping",
    );
  }
}

function templateLabel(kind: DocumentTemplateKind): string {
  return kind === "cv" ? "CV template" : "cover letter template";
}
