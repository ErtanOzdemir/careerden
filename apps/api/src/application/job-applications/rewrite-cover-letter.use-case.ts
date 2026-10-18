import { aiCoverLetterRewriteSchema } from "../../contracts/matching/ai-cover-letter-rewrite.schema.js";
import type {
  AiProvider,
  BillingSubscriptionRepository,
  DocumentContent,
  JobApplicationRepository,
  RichDocument,
  UserProfileAccountRepository,
} from "@careerden/domain";
import {
  collectSupportedDurationClaims,
  richDocumentToPlainText,
  sanitizeDurationClaims,
} from "@careerden/domain";
import { ApplicationError, resolveAiTier } from "@careerden/application";
import { resolveDocumentContent } from "@careerden/application";
import { durationClaimRules, factualityRules } from "@careerden/application";
import { getAccessibleJobApplication } from "@careerden/application";

/**
 * Rewrites the cover letter from the candidate's current, edited CV draft. The match analysis writes
 * the first cover letter before the candidate applies any tips, so it cannot reflect them; this
 * brings the letter back in line with the CV they will actually send.
 *
 * Like ApplyDocumentFieldTipUseCase, nothing is persisted here and no credit is reserved: the
 * frontend shows the result as a proposal and saves it with the rest of the draft once accepted.
 */
export class RewriteCoverLetterUseCase {
  constructor(
    private readonly jobApplications: JobApplicationRepository,
    private readonly profiles: UserProfileAccountRepository,
    private readonly aiProvider: AiProvider,
    private readonly subscriptions: Pick<BillingSubscriptionRepository, "findByUserId">,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    jobApplicationId: string,
    userId: string,
    input: { documentContent: DocumentContent },
  ): Promise<RichDocument> {
    const jobApplication = await getAccessibleJobApplication(
      this.jobApplications,
      this.profiles,
      jobApplicationId,
      userId,
    );
    const [scrape, profile] = await Promise.all([
      this.jobApplications.getScrapeBundle(jobApplicationId),
      this.profiles.findById(jobApplication.profileId),
    ]);
    if (!scrape || !profile) {
      throw new ApplicationError(
        "validation",
        "Rewriting the cover letter requires a scraped job and a profile",
      );
    }

    const content = resolveDocumentContent(profile, input.documentContent);
    const currentCoverLetter = input.documentContent.coverLetterContent;
    const preferences = jobApplication.applicationPackPreferences;

    const output = await this.aiProvider.generate({
      tier: await resolveAiTier(this.subscriptions, userId, this.now()),
      system: rewriteCoverLetterSystemPrompt(),
      prompt: JSON.stringify({
        outputPreferences: { language: preferences.language, tone: preferences.tone },
        job: {
          title: scrape.job.title,
          companyName: jobApplication.tracking.companyName ?? scrape.job.companyName,
          requirements: scrape.job.requirements,
        },
        candidate: { fullName: profile.fullName },
        tailoredCv: {
          summary: richDocumentToPlainText(content.summary),
          skills: content.skills,
          certifications: content.certifications,
          experience: content.experiences.map((experience) => ({
            title: experience.title,
            company: experience.company,
            description: experience.description
              ? richDocumentToPlainText(experience.description)
              : "",
          })),
          projects: content.projects.map((project) => ({
            name: project.name,
            skills: project.skills,
            description: project.description ? richDocumentToPlainText(project.description) : "",
          })),
          education: content.education.map((education) => ({
            institution: education.institution,
            degree: education.degree ?? "",
            field: education.field ?? "",
          })),
        },
        ...(currentCoverLetter && richDocumentToPlainText(currentCoverLetter)
          ? { currentCoverLetter: richDocumentToPlainText(currentCoverLetter) }
          : {}),
        requiredOutput: {
          paragraphs:
            "The complete cover letter body as an ordered list of paragraphs, one paragraph per entry, without markdown. Must never be empty.",
        },
      }),
      outputSchema: aiCoverLetterRewriteSchema,
    });

    const supported = collectSupportedDurationClaims(profile);
    const paragraphs = output.paragraphs
      .map((paragraph) => sanitizeDurationClaims(paragraph.trim().replace(/\s+/g, " "), supported))
      .filter(Boolean);

    if (paragraphs.length === 0) {
      throw new ApplicationError("validation", "The AI did not return a usable cover letter");
    }

    return {
      version: 1,
      blocks: paragraphs.map((text) => ({
        type: "paragraph",
        children: [{ type: "text", text }],
      })),
    };
  }
}

function rewriteCoverLetterSystemPrompt(): string {
  return [
    "You write a concise, professional cover letter body for a specific job, based on the candidate's tailored CV.",
    "tailoredCv is the exact CV the candidate will send and the only source of facts about them. Mention only experience, skills, projects, and education it contains, and prefer the items most relevant to job.requirements.",
    ...factualityRules,
    ...durationClaimRules,
    "When currentCoverLetter is provided, keep its opening and closing style and any sentences that are still accurate, and update the rest so the letter matches tailoredCv. The candidate may have edited it by hand; preserve their voice.",
    "Address the role and company by name. Keep it to three or four short paragraphs.",
    "Follow outputPreferences for language and tone. When language is auto, use the language of currentCoverLetter, or else the language of the job requirements.",
    "Return only valid JSON matching the provided output schema.",
  ].join(" ");
}
