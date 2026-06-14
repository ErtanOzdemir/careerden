import { aiJobRequirementsSchema } from "@link2cv/contracts";
import type { AiProvider, ScrapedJob } from "@link2cv/domain";

export class ExtractJobRequirementsUseCase {
  constructor(private readonly aiProvider: AiProvider) {}

  async execute(input: {
    jobApplicationId: string;
    job: ScrapedJob;
  }): Promise<ScrapedJob> {
    const result = await this.aiProvider.generate({
      system: [
        "You extract job requirements from scraped job descriptions.",
        "Use only requirements that are directly supported by the job description.",
        "Return concise requirements as standalone strings.",
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
      outputSchema: aiJobRequirementsSchema,
    });

    return {
      ...input.job,
      requirements: result.requirements,
    };
  }
}
