import {
  aiFieldTipRevisionSchema,
  type AiFieldTipRevisionBlockDto,
} from "../../contracts/matching/ai-field-tip-revision.schema.js";
import type { ApplyFieldTipFieldRef } from "../../contracts/documents/apply-field-tip.schema.js";
import type {
  AiProvider,
  JobApplicationRepository,
  RichDocument,
  UserProfileAccountRepository,
} from "@careerden/domain";
import { ApplicationError } from "@careerden/application";
import {
  durationClaimRules,
  factualityRules,
  jobPostingDataRules,
  promptWithJobPostingData,
} from "@careerden/application";
import { createTipGrounding } from "@careerden/application";
import {
  revisionBlocksToRichDocument,
  richDocumentToRevisionBlocks,
} from "./field-tip-revision-blocks.js";
import { getAccessibleJobApplication } from "@careerden/application";

interface FieldTipSuggestion {
  tip: string;
  requirement?: string;
  evidence?: string;
}

export interface ApplyDocumentFieldTipInput extends FieldTipSuggestion {
  field: ApplyFieldTipFieldRef;
  currentValue: RichDocument;
  additionalTips?: FieldTipSuggestion[];
  candidateAnswer?: string;
}

interface PromptSuggestion {
  tip: string;
  targetRequirement?: string;
  profileEvidence?: string;
}

/**
 * Revises exactly one CV field, grounded in the job's context, applying exactly one improvement
 * tip the user chose to act on. The field's paragraph/list structure is sent to and returned by the
 * AI so bullet points survive the revision. Not persisted here — the frontend shows the returned
 * value as a proposal, merges it into its draft `DocumentContent` only once the user accepts it, and
 * saves it through the existing `PUT /:id/document-content` route, same as any other manual edit.
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
    const jobApplication = await getAccessibleJobApplication(
      this.jobApplications,
      this.profiles,
      jobApplicationId,
      userId,
    );
    const scrape = await this.jobApplications.getScrapeBundle(jobApplicationId);
    if (!scrape) {
      throw new ApplicationError(
        "validation",
        "Applying a tip requires a scraped job to ground the revision in",
      );
    }

    // The tip's links come from the client, so re-verify them against the current profile and job
    // (the profile may also have changed since the analysis ran) before treating them as facts.
    const profile = await this.profiles.findById(jobApplication.profileId);
    const grounding = profile ? createTipGrounding(profile, scrape.job.requirements) : undefined;
    const suggestions = [input, ...(input.additionalTips ?? [])].map(
      (suggestion): PromptSuggestion => {
        const requirement = suggestion.requirement
          ? grounding?.requirement(suggestion.requirement)
          : undefined;
        const evidence = suggestion.evidence ? grounding?.evidence(suggestion.evidence) : undefined;
        return {
          tip: suggestion.tip,
          ...(requirement ? { targetRequirement: requirement } : {}),
          ...(evidence ? { profileEvidence: evidence } : {}),
        };
      },
    );

    const revision = await this.aiProvider.generate({
      system: applyFieldTipSystemPrompt(),
      prompt: applyFieldTipPrompt({
        field: input.field,
        jobTitle: scrape.job.title,
        jobRequirements: scrape.job.requirements,
        currentContent: richDocumentToRevisionBlocks(input.currentValue),
        suggestions,
        candidateAnswer: input.candidateAnswer,
        tone: jobApplication.applicationPackPreferences.tone,
      }),
      outputSchema: aiFieldTipRevisionSchema,
      // The user is waiting on this single-field revision; the analysis already did the reasoning.
      thinking: false,
    });

    const revised = revisionBlocksToRichDocument(revision.blocks);
    return revised.blocks.length > 0 ? revised : input.currentValue;
  }
}

function applyFieldTipSystemPrompt(): string {
  return [
    "You are revising exactly one CV field based on the improvement suggestions the candidate chose to apply. Apply every suggestion in the suggestions list in a single coherent revision.",
    ...jobPostingDataRules,
    ...factualityRules,
    ...durationClaimRules,
    "Never add a sentence, claim, or keyword that a suggestion asks you to copy word for word unless currentContent, profileEvidence, or candidateAnswer already supports it.",
    "Apply the suggestion truthfully, grounded only in the current field content and the job context provided. If the suggestion cannot be satisfied without inventing a fact, produce the best faithful improvement you can instead of fabricating.",
    "When a suggestion has profileEvidence, it is a verified fact from the candidate's own profile: use it to satisfy that suggestion, but do not add anything beyond it. When a suggestion has targetRequirement, make the revised field address it only as far as the current content and profileEvidence truthfully support.",
    "When candidateAnswer is provided, the suggestion is a question the candidate just answered about their own experience. Treat the answer as true and add what it states in concise CV style, but do not add anything it does not state: no extra metrics, scope, seniority, or outcomes. If the answer says they lack the experience, return the current content unchanged.",
    "Change only what the suggestion requires. Keep every other sentence, fact, metric, and technology from the current content; never drop existing metrics.",
    "Preserve the field's structure: keep bullet lists as bullet lists with one achievement per item, keep numbered lists numbered, and keep paragraphs as paragraphs. Do not merge list items into prose. You may add or reorder list items when the suggestion calls for it.",
    "Write in the same language as the current content.",
    "Return the full revised field as blocks: kind 'paragraphs' (one paragraph per line), 'bullets', or 'numbered' (one list item per line). Do not put list markers, markdown, commentary, or quotation marks inside lines.",
    "Return only valid JSON matching the provided output schema.",
  ].join(" ");
}

function applyFieldTipPrompt(input: {
  field: ApplyFieldTipFieldRef;
  jobTitle: string;
  jobRequirements: string[];
  currentContent: AiFieldTipRevisionBlockDto[];
  suggestions: PromptSuggestion[];
  candidateAnswer?: string;
  tone: string;
}): string {
  return promptWithJobPostingData(
    {
      jobPostingLocation:
        "jobTitle and jobRequirements are in the job_posting_data block at the end of this message.",
      field: fieldContext(input.field),
      currentContent: input.currentContent,
      suggestions: input.suggestions,
      ...(input.candidateAnswer ? { candidateAnswer: input.candidateAnswer } : {}),
      tone: input.tone,
      requiredOutput: {
        blocks:
          "The full revised field content incorporating every suggestion, in the same block structure as currentContent. Must never be empty.",
      },
    },
    { jobTitle: input.jobTitle, jobRequirements: input.jobRequirements },
  );
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
