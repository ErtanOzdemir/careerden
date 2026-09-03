import { aiFieldTipRevisionSchema } from "@careerden/contracts";
import type { ApplyFieldTipFieldRef } from "@careerden/contracts";
import type {
  AiProvider,
  JobApplicationRepository,
  RichDocument,
  UserProfileAccountRepository,
} from "@careerden/domain";
import { richDocumentFromText, richDocumentToPlainText } from "@careerden/domain";
import { ApplicationError } from "../application-error.js";
import { durationClaimRules, factualityRules } from "../matching/run-match-analysis.use-case.js";
import { getAccessibleJobApplication } from "./job-application-access.js";

export interface ApplyDocumentFieldTipInput {
  field: ApplyFieldTipFieldRef;
  currentValue: RichDocument;
  tip: string;
}

/**
 * Revises exactly one CV field, grounded in the job's context, applying exactly one improvement
 * tip the user chose to act on. Not persisted here — the frontend merges the returned value into
 * its draft `DocumentContent` and saves it through the existing `PUT /:id/document-content` route
 * when the user is ready, same as any other manual edit.
 *
 * Deliberately mirrors PreviewApplicationPackUseCase's shape: no `unitOfWork`, no credit
 * reservation/consumption. Applying a tip is included in the AI credit already spent on the
 * analysis that produced it, not a separately metered action.
 */
export class ApplyDocumentFieldTipUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccountRepository,
    private readonly aiProvider: AiProvider,
  ) {}

  async execute(
    jobApplicationId: string,
    userId: string,
    input: ApplyDocumentFieldTipInput,
  ): Promise<RichDocument> {
    await getAccessibleJobApplication(this.jobApplications, this.profiles, jobApplicationId, userId);
    const scrape = await this.jobApplications.getScrapeBundle(jobApplicationId);
    if (!scrape) {
      throw new ApplicationError(
        "validation",
        "Applying a tip requires a scraped job to ground the revision in",
      );
    }

    const currentText = richDocumentToPlainText(input.currentValue);
    const revision = await this.aiProvider.generate({
      system: applyFieldTipSystemPrompt(),
      prompt: applyFieldTipPrompt({
        field: input.field,
        jobTitle: scrape.job.title,
        jobRequirements: scrape.job.requirements,
        currentText,
        tip: input.tip,
      }),
      outputSchema: aiFieldTipRevisionSchema,
    });

    const revisedText = revision.revisedText.trim();
    return richDocumentFromText(revisedText || currentText);
  }
}

function applyFieldTipSystemPrompt(): string {
  return [
    "You are revising exactly one CV field based on one specific improvement suggestion the candidate chose to apply.",
    ...factualityRules,
    ...durationClaimRules,
    "Apply the suggestion truthfully, grounded only in the current field text and the job context provided. If the suggestion cannot be satisfied without inventing a fact, produce the best faithful improvement you can instead of fabricating.",
    "Return only the revised field text as plain prose — no markdown, no bullet points, no commentary, no quotation marks around the result.",
    "Return only valid JSON matching the provided output schema.",
  ].join(" ");
}

function applyFieldTipPrompt(input: {
  field: ApplyFieldTipFieldRef;
  jobTitle: string;
  jobRequirements: string[];
  currentText: string;
  tip: string;
}): string {
  return JSON.stringify({
    jobTitle: input.jobTitle,
    jobRequirements: input.jobRequirements,
    field: fieldContext(input.field),
    currentText: input.currentText,
    tip: input.tip,
    requiredOutput: {
      revisedText: "The full revised field text, incorporating the tip. Must never be empty.",
    },
  });
}

function fieldContext(field: ApplyFieldTipFieldRef): string {
  switch (field.type) {
    case "summary":
      return "CV summary";
    case "experience":
      return `experience item ${field.index}`;
    case "education":
      return `education item ${field.index}`;
    case "project":
      return `project item ${field.index}`;
  }
}
