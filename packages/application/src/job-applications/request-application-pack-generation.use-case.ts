import type {
  ApplicationPackPreferences,
  DocumentContent,
  PersistenceUnitOfWork,
} from "@careerden/domain";
import { normalizeApplicationPackPreferences } from "@careerden/domain";
import type { DocumentTemplateKind } from "@careerden/contracts";
import { getHtmlTemplateById } from "@careerden/contracts";
import { ApplicationError } from "../application-error.js";
import { enqueueApplicationPackGeneration } from "./enqueue-application-pack-generation.js";
import { getActiveAccessibleJobApplication } from "./job-application-access.js";

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
        let jobApplication = await getActiveAccessibleJobApplication(
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
        validateApplicationPackPreferences(preferences);

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

export function validateApplicationPackPreferences(preferences: ApplicationPackPreferences): void {
  validateTemplate(preferences.cvTemplateId, "cv");
  validateTemplate(preferences.coverLetterTemplateId, "cover_letter");
}

function validateTemplate(templateId: string | undefined, kind: DocumentTemplateKind): void {
  if (!templateId) return;

  const template = getHtmlTemplateById(templateId);
  if (!template || template.kind !== kind) {
    throw new ApplicationError("validation", `Selected ${templateLabel(kind)} is not available`);
  }
}

function templateLabel(kind: DocumentTemplateKind): string {
  return kind === "cv" ? "CV template" : "cover letter template";
}
