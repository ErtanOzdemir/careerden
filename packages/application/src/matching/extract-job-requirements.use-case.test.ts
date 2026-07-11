import { describe, expect, it } from "vitest";
import type { AiGenerateParams, AiProvider, ScrapedJob } from "@link2cv/domain";
import { ExtractJobRequirementsUseCase } from "./extract-job-requirements.use-case.js";

describe("ExtractJobRequirementsUseCase", () => {
  it("extracts requirements from the raw job description and preserves scraped job facts", async () => {
    const calls: Array<AiGenerateParams<unknown>> = [];
    const job: ScrapedJob = {
      title: "Backend Engineer",
      companyName: "Example Inc",
      location: "Remote",
      description:
        "We need 5+ years of TypeScript experience and experience building distributed services.",
      requirements: [],
      companyLinkedInUrl: "https://www.linkedin.com/company/example",
      raw: { sourceUrl: "https://www.linkedin.com/jobs/view/123" },
    };
    const provider: AiProvider = {
      async generate<T>(params: AiGenerateParams<T>): Promise<T> {
        calls.push(params as AiGenerateParams<unknown>);
        return params.outputSchema.parse({
          requirements: [
            "5+ years of TypeScript experience",
            "Experience building distributed services",
          ],
        }) as T;
      },
    };

    const enriched = await new ExtractJobRequirementsUseCase(provider).execute({
      jobApplicationId: "job-application-1",
      job,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.system).toContain("Use only requirements that are directly supported");
    expect(JSON.parse(calls[0]?.prompt ?? "{}")).toMatchObject({
      jobApplicationId: "job-application-1",
      title: "Backend Engineer",
      companyName: "Example Inc",
      location: "Remote",
      description: job.description,
    });
    expect(enriched).toEqual({
      ...job,
      requirements: [
        "5+ years of TypeScript experience",
        "Experience building distributed services",
      ],
    });
  });
});
