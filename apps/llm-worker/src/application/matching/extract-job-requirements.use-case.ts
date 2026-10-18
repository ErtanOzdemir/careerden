import {
  aiJobRequirementsCandidateSchema,
  aiJobRequirementsSchema,
} from "../../contracts/matching/ai-job-requirements.schema.js";
import type { AiProvider, AiTier, ScrapedJob } from "@careerden/domain";

export class ExtractJobRequirementsUseCase {
  constructor(private readonly aiProvider: AiProvider) {}

  async execute(input: {
    jobApplicationId: string;
    job: ScrapedJob;
    aiTier: AiTier;
  }): Promise<ScrapedJob> {
    const candidate = await this.aiProvider.generate({
      tier: input.aiTier,
      system: [
        "You extract job requirements from scraped job descriptions.",
        "Use only requirements that are directly supported by the job description.",
        "Return concise requirements as standalone strings.",
        "Return at least one requirement whenever the description contains responsibilities, tasks, skills, experience, qualifications, tools, or working constraints.",
        "When explicit qualifications are absent, treat concrete role responsibilities and tasks as requirements.",
        "Do not infer, guess, summarize the company, or include benefits.",
      ].join(" "),
      prompt: JSON.stringify({
        jobApplicationId: input.jobApplicationId,
        title: input.job.title,
        companyName: input.job.companyName,
        location: input.job.location,
        description: input.job.description,
        requiredOutput: {
          requirements:
            "Concrete skills, experience, qualifications, responsibilities, tools, and constraints from the job description only.",
        },
      }),
      outputSchema: aiJobRequirementsCandidateSchema,
    });
    const requirements =
      candidate.requirements.length > 0
        ? candidate.requirements
        : requirementsFromDescription(input.job);
    const result = aiJobRequirementsSchema.parse({ requirements });

    return {
      ...input.job,
      requirements: result.requirements,
    };
  }
}

const requirementSignals =
  /\b(ability|build\w*|collaborat\w*|develop\w*|experience|knowledge|lead\w*|manag\w*|must|proficien\w*|required|responsib\w*|skills?|work with|you will)\b/i;

function requirementsFromDescription(job: ScrapedJob): string[] {
  const chunks = job.description
    .replaceAll(/<[^>]+>/g, " ")
    .split(/\r?\n+|(?<=[.!?])\s+/)
    .map((chunk) =>
      chunk
        .replace(/^[\s*•·▪◦\-–—\d.)]+/, "")
        .replaceAll(/\s+/g, " ")
        .trim(),
    )
    .filter((chunk) => chunk.length >= 8);
  const signaled = chunks.filter((chunk) => requirementSignals.test(chunk));
  const selected = (signaled.length > 0 ? signaled : chunks).slice(0, 5);

  if (selected.length > 0) {
    return selected.map(limitRequirementLength);
  }

  return [limitRequirementLength(`Role: ${job.title}`)];
}

function limitRequirementLength(requirement: string): string {
  if (requirement.length <= 180) return requirement;
  return `${requirement.slice(0, 177).trimEnd()}...`;
}
