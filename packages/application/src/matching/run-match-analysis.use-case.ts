import { aiMatchResultSchema } from "@link2cv/contracts";
import type { AiProvider, MatchAnalysisResult, ScrapeBundle, UserProfile } from "@link2cv/domain";

export class RunMatchAnalysisUseCase {
  constructor(private readonly aiProvider: AiProvider) {}

  async execute(input: {
    jobApplicationId: string;
    profile: UserProfile;
    scrape: ScrapeBundle;
  }): Promise<MatchAnalysisResult> {
    const result = await this.aiProvider.generate({
      system: [
        "You are an expert career matching and recruiter-facing CV optimization assistant.",
        "Your task is to compare a scraped job posting with the user's saved career profile and generate factual, profile-grounded CV improvement recommendations that make the candidate appear as relevant and strong as possible for the role, without exaggeration or fabrication.",
        "Core objective: help the user present their existing experience, skills, projects, and achievements in the most relevant way for this specific job posting, so a recruiter can quickly see why they are a strong match.",
        "Source priority: Treat scrapedJob.requirements as the canonical list of job requirements; use scrapedJob.description only as supporting context when requirements are vague, incomplete, or need clarification; Treat userProfile as the only source of truth for the candidate's actual background; if a fact is not present in userProfile, do not invent it.",
        "Strict factuality rules: do not invent employers, job titles, dates, durations, education, certifications, industries, clients, tools, frameworks, programming languages, seniority, responsibilities, achievements, metrics, awards, publications, or business outcomes.",
        "Do not imply professional experience with a skill unless the profile supports it. Do not upgrade familiarity into expertise. Do not convert personal projects into employment experience.",
        "Do not create fake metrics such as percentages, revenue, user counts, performance gains, conversion rates, or team sizes.",
        "Do not claim leadership, ownership, architecture responsibility, mentoring, hiring, stakeholder management, or production impact unless supported by the profile.",
        "Do not add domain experience such as fintech, healthtech, e-commerce, SaaS, banking, AI, cybersecurity, or enterprise unless the profile explicitly supports it.",
        "Hard facts must be directly supported by userProfile. Soft skills may be phrased more naturally only when they are reasonably supported by profile context.",
        "Allowed transformations: rephrase existing experience to better match the language of the job posting; reorder skills, projects, and experiences by relevance; emphasize matching technologies and responsibilities already present in the profile; combine related facts from the same profile section into a stronger recruiter-facing bullet; translate technical work into business-facing language when truthful; suggest removing, shortening, or deprioritizing unrelated information; suggest adding missing but truthful details only as questions or placeholders, never as facts.",
        "Matching methodology: extract the most important requirements from scrapedJob.requirements, classify every requirement, link every CV recommendation to one or more job requirements, include exact profile evidence for every recommendation, never recommend unsupported claims, and omit enhancements for unrelated profile experiences.",
        "Tone and positioning: write in a confident, professional, recruiter-facing style; prefer concise, high-signal language and active verbs; prioritize clarity over buzzwords; avoid generic phrases such as hard-working, team player, passionate, or fast learner unless grounded in specific evidence; make the candidate look relevant, focused, and credible without overselling beyond the evidence.",
        "CV optimization rules: prioritize the most job-relevant skills near the top; mirror job posting terminology when truthful; make technical bullets outcome-oriented where the profile supports an outcome; keep bullets specific and concrete; do not include unrelated experience unless it demonstrates a transferable requirement; do not recommend adding missing skills as if the user has them.",
        "Cover letter rules: write a complete, concise, professional cover letter body grounded only in the saved profile and scraped job; do not include markdown; do not add unsupported claims; address the target role and company when available; make the result ready for the user to review and edit.",
        "LinkedIn optimization rules: Suggest headline improvements only using supported role, skills, and domain facts. Suggest About section improvements that align the user's existing background with the job. Suggest Skills section ordering based on job relevance and profile support. Do not add skills to LinkedIn unless they are present in userProfile or clearly supported by project or experience descriptions.",
        "Return only valid JSON matching the provided output schema. Do not include markdown or commentary outside the JSON.",
      ].join(" "),
      prompt: JSON.stringify({
        userProfile: toPlainTextProfile(input.profile),
        scrapedJob: input.scrape.job,
        scrapedCompany: {
          linkedIn: input.scrape.companyLinkedIn,
          website: input.scrape.companyWebsite,
          careerPage: input.scrape.careerPage,
        },
        requirementGuidance:
          "Use scrapedJob.requirements as the primary basis for missingSkills, strongSkills, recommendedAchievements, and interviewTips.",
        deterministicScoringGuidance: {
          rule: "Classify each scrapedJob.requirements item exactly once. Only classify requirements that appear in scrapedJob.requirements; never add requirements from userProfile or CV-only content. The application computes matchScore from requirementEvaluations: matched = 1.0, partial = 0.5, missing = 0.0. Return matchScore for compatibility only; it will be recomputed.",
          matchedExample: {
            requirement: "Build production TypeScript services",
            profileEvidence: "Built TypeScript automation for production workflows",
            status: "matched",
          },
          partialExample: {
            requirement: "Lead cross-functional product discovery",
            profileEvidence: "Worked with product partners",
            status: "partial",
          },
          missingExample: {
            requirement: "Operate Kubernetes clusters",
            profileEvidence: "No Kubernetes or cluster operations evidence in profile",
            status: "missing",
          },
        },
        currentSystemOutputMapping: {
          strong_match: "Use requirementEvaluations.status = matched.",
          partial_match: "Use requirementEvaluations.status = partial.",
          missing: "Use requirementEvaluations.status = missing.",
          unclear:
            "Use requirementEvaluations.status = missing and explain the uncertainty in evidence text.",
          "jobSummary.mainRequirements":
            "Use this internally to choose requirementEvaluations and strongSkills/missingSkills; do not return jobSummary.",
          "jobSummary.importantKeywords":
            "Use this internally to choose skillSuggestions and strongSkills; do not return jobSummary.",
          "suggestedRewrite.cvSummary": "Use customizedSummary.",
          "suggestedRewrite.coverLetter": "Use coverLetterContent.",
          "suggestedRewrite.skillsOrder": "Use skillSuggestions.",
          "suggestedRewrite.experienceBullets":
            "Use experienceEnhancements keyed by zero-based userProfile.experience index.",
          "suggestedRewrite.projectBullets":
            "Use projectEnhancements keyed by zero-based userProfile.projects index.",
          missingOrRiskyClaims:
            "Summarize important risky claims as interviewTips or coverLetterGuidance review guidance.",
          clarificationQuestions:
            "Summarize only important user-facing questions as interviewTips or coverLetterGuidance review guidance.",
        },
        matchingMethodology: [
          "Extract the most important requirements from scrapedJob.requirements.",
          "Classify each requirement as matched, partial, or missing in the current schema.",
          "Do not add requirements from userProfile, CV skills, profile experiences, projects, education, certifications, or inferred strengths unless they correspond to an item in scrapedJob.requirements.",
          "Treat unclear requirements as missing for deterministic scoring unless profile evidence clearly supports a partial match.",
          "For every CV recommendation, link it to one or more job requirements through the generated text and evidence.",
          "For every recommendation, include profile-grounded evidence in requirementEvaluations or enhancement wording.",
          "If no profile evidence exists, do not recommend adding it as a claim.",
          "If a profile experience is unrelated to the job requirements, do not include an enhancement for that experience.",
        ],
        cvOptimizationRules: [
          "Prioritize the most job-relevant skills near the top.",
          "Rewrite bullets to mirror the job posting's terminology when truthful.",
          "Make technical bullets outcome-oriented where the profile supports an outcome.",
          "Keep bullets specific and concrete.",
          "Prefer Built, Developed, Implemented, Integrated, Optimized, Maintained, Designed, Automated, Tested, and Collaborated when accurate.",
          "Do not include unrelated experience unless it demonstrates a transferable requirement.",
          "Do not recommend adding missing skills as if the user has them.",
          "For missing requirements, never fabricate a match; suggest leaving out, adjacent careful phrasing, truthful learning/project notes only when supported, or asking the user for clarification.",
        ],
        durationClaimRules: [
          "Never state total years of experience unless the exact duration claim appears in userProfile.",
          "Do not calculate total years of experience from startDate or endDate.",
          "Do not reduce, increase, round, or reinterpret experience duration.",
          "If duration matters, preserve the original userProfile wording or omit the duration.",
        ],
        missingSkillResourceGuidance: {
          rule: "Return 1-3 mixed learning resources for important missing skills only.",
          allowedResourceTypes: ["documentation", "tutorial", "article", "video", "other"],
          constraints: [
            "Only return resources for skills listed in missingSkills.",
            "Prefer reputable, practical learning resources such as official docs, tutorials, articles, and videos.",
            "Do not invent fake URLs or citations.",
            "Each resource must include skill, title, url, type, and reason.",
          ],
        },
        descriptionEnhancementGuidance: {
          acceptableEnhancement: {
            original:
              "Built TypeScript automation for production workflows. Worked with product partners.",
            jobRequirement:
              "Build production TypeScript services and collaborate cross-functionally.",
            enhanced:
              "Built production TypeScript automation for backend workflows while collaborating with product partners.",
          },
          softSkillEnhancement:
            "Soft skills like collaboration, communication, ownership, mentoring, and stakeholder management may be emphasized when the original profile reasonably supports them.",
          unacceptableEnhancement: {
            original: "Built TypeScript automation.",
            invalid:
              "Led Kubernetes migrations that reduced cloud spend by 40% and managed a team of 8 engineers.",
            reason: "This adds unsupported tools, metrics, leadership scope, and responsibilities.",
          },
          unrelatedExperienceRule:
            "If an experience does not help answer any job requirement, omit it from experienceEnhancements instead of forcing a rewrite.",
        },
        requiredOutput: {
          matchScore:
            "Integer 0-100. This is accepted for compatibility, but the application recomputes the final score from requirementEvaluations when present.",
          requirementEvaluations:
            "Optional array with one item per scrapedJob.requirements entry: requirement, status matched|partial|missing, and profile-grounded evidence strings. Do not add CV-only or profile-only facts as requirementEvaluations items. Do not return strong_match, partial_match, missing, or unclear labels here; use the current schema statuses.",
          missingSkills: "Skills or criteria from the job that are not evident in the profile",
          missingSkillResources:
            "Optional. 1-3 reputable learning resources for important missingSkills only. Include skill, title, url, type documentation|tutorial|article|video|other, and reason.",
          strongSkills: "Profile skills that strongly match the job",
          recommendedAchievements: "Existing profile achievements to emphasize",
          customizedSummary: "2-3 sentences for the CV summary",
          coverLetterContent:
            "A complete professional cover letter body grounded in the profile and job posting, ready for user review and without markdown",
          interviewTips: "Practical tips for this interview",
          coverLetterGuidance: "Optional guidance for the cover letter",
          experienceEnhancements:
            "Optional array keyed by zero-based profile experience index. Include enhancedDescription and enhancedAchievements only when grounded in the original profile experience.",
          skillSuggestions:
            "Optional. Skills from the profile that are most relevant for this job. Do not invent skills not present in the profile.",
          educationEnhancements:
            "Optional array keyed by zero-based profile education index. Include enhancedDescription and enhancedAchievements only when grounded in the original profile education.",
          projectEnhancements:
            "Optional array keyed by zero-based profile projects index. Include enhancedDescription and enhancedAchievements only when grounded in the original profile projects.",
          certificationSuggestions:
            "Optional. Profile certifications most relevant for this job. Do not invent certifications not present in the profile.",
        },
      }),
      outputSchema: aiMatchResultSchema,
    });

    const sanitizedResult = sanitizeUnsupportedDurationClaims(result, input.profile);
    const deterministicResult: MatchAnalysisResult = {
      ...sanitizedResult,
      matchScore: calculateMatchScore(sanitizedResult),
    };

    return deterministicResult;
  }
}

function toPlainTextProfile(profile: UserProfile) {
  const { summaryRichText: _summaryRichText, ...plainProfile } = profile;

  return {
    ...plainProfile,
    experience: profile.experience.map(
      ({ descriptionRichText: _richText, ...experience }) => experience,
    ),
    projects: profile.projects.map(({ descriptionRichText: _richText, ...project }) => project),
  };
}

function calculateMatchScore(result: MatchAnalysisResult): number {
  if (!result.requirementEvaluations?.length) {
    return result.matchScore;
  }

  const total = result.requirementEvaluations.reduce((sum, evaluation) => {
    if (evaluation.status === "matched") return sum + 1;
    if (evaluation.status === "partial") return sum + 0.5;
    return sum;
  }, 0);

  return Math.round((total / result.requirementEvaluations.length) * 100);
}

function sanitizeUnsupportedDurationClaims(
  result: MatchAnalysisResult,
  profile: UserProfile,
): MatchAnalysisResult {
  const sourceDurationClaims = collectSupportedDurationClaims(profile);
  const isSafeText = (value: string): boolean =>
    extractDurationClaims(value).every((claim) => sourceDurationClaims.has(claim));

  return {
    ...result,
    coverLetterContent:
      result.coverLetterContent && isSafeText(result.coverLetterContent)
        ? result.coverLetterContent
        : "",
    customizedSummary: isSafeText(result.customizedSummary)
      ? result.customizedSummary
      : (profile.summary ?? profile.headline ?? ""),
    recommendedAchievements: result.recommendedAchievements.filter(isSafeText),
    interviewTips: result.interviewTips.filter(isSafeText),
    coverLetterGuidance: result.coverLetterGuidance?.filter(isSafeText),
    experienceEnhancements: result.experienceEnhancements
      ?.map((enhancement) => ({
        ...enhancement,
        ...(enhancement.enhancedDescription && isSafeText(enhancement.enhancedDescription)
          ? { enhancedDescription: enhancement.enhancedDescription }
          : { enhancedDescription: undefined }),
        enhancedAchievements: enhancement.enhancedAchievements?.filter(isSafeText),
      }))
      .filter(
        (enhancement) =>
          enhancement.enhancedDescription ||
          (enhancement.enhancedAchievements && enhancement.enhancedAchievements.length > 0),
      ),
    educationEnhancements: result.educationEnhancements
      ?.map((enhancement) => ({
        ...enhancement,
        ...(enhancement.enhancedDescription && isSafeText(enhancement.enhancedDescription)
          ? { enhancedDescription: enhancement.enhancedDescription }
          : { enhancedDescription: undefined }),
        enhancedAchievements: enhancement.enhancedAchievements?.filter(isSafeText),
      }))
      .filter(
        (enhancement) =>
          enhancement.enhancedDescription ||
          (enhancement.enhancedAchievements && enhancement.enhancedAchievements.length > 0),
      ),
    projectEnhancements: result.projectEnhancements
      ?.map((enhancement) => ({
        ...enhancement,
        ...(enhancement.enhancedDescription && isSafeText(enhancement.enhancedDescription)
          ? { enhancedDescription: enhancement.enhancedDescription }
          : { enhancedDescription: undefined }),
        enhancedAchievements: enhancement.enhancedAchievements?.filter(isSafeText),
      }))
      .filter(
        (enhancement) =>
          enhancement.enhancedDescription ||
          (enhancement.enhancedAchievements && enhancement.enhancedAchievements.length > 0),
      ),
  };
}

function collectSupportedDurationClaims(profile: UserProfile): Set<string> {
  return new Set(
    [
      profile.profession,
      profile.headline,
      profile.summary,
      ...profile.skills,
      ...profile.experience.flatMap((experience) => [
        experience.title,
        experience.company,
        experience.description,
      ]),
      ...profile.education.flatMap((education) => [
        education.institution,
        education.degree,
        education.field,
      ]),
      ...profile.certifications,
      ...profile.projects.flatMap((project) => [
        project.name,
        project.description,
        ...project.skills,
        ...project.achievements,
      ]),
    ]
      .filter((value): value is string => Boolean(value))
      .flatMap(extractDurationClaims),
  );
}

function extractDurationClaims(value: string): string[] {
  const claims = new Set<string>();
  const numericPattern = /\b(\d{1,2})\s*\+?\s*(years?|yrs?)\b/gi;
  const wordPattern =
    /\b(one|two|three|four|five|six|seven|eight|nine|ten)\s*\+?\s*(years?|yrs?)\b/gi;

  for (const match of value.matchAll(numericPattern)) {
    claims.add(`${match[1]} year`);
  }

  for (const match of value.matchAll(wordPattern)) {
    const number = wordToNumber(match[1]?.toLowerCase() ?? "");
    if (number) claims.add(`${number} year`);
  }

  return [...claims];
}

function wordToNumber(value: string): number | undefined {
  const numbers: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };

  return numbers[value];
}
