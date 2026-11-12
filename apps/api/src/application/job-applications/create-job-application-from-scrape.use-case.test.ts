import { describe, expect, it, vi } from "vitest";
import { CreateJobApplicationFromScrapeUseCase } from "./create-job-application-from-scrape.use-case.js";
import {
  createJobApplicationRepository,
  createScrapeBundle,
  createTestJobApplication,
  createUnitOfWork,
} from "@careerden/application/testing";

describe("CreateJobApplicationFromScrapeUseCase", () => {
  it("persists desktop scrape data and enqueues enabled analysis", async () => {
    const job = createTestJobApplication({ status: "queued" });
    const repository = createJobApplicationRepository({ create: vi.fn(async () => job) });
    const currentProfile = {
      execute: vi.fn(
        async () =>
          ({
            id: "profile-1",
            autoRunMatchAnalysis: true,
            profession: "Software Engineer",
            skillGroups: [{ name: "", skills: ["TypeScript"] }],
            experience: [],
            projects: [],
            education: [],
            certifications: [],
          }) as never,
      ),
    };
    const { unitOfWork, addOutboxEvent, recordChanged } = createUnitOfWork(repository);

    await new CreateJobApplicationFromScrapeUseCase(currentProfile, unitOfWork).execute(
      { id: "user-1", name: "Ada", email: "ada@example.com" },
      { sourceUrl: "https://www.linkedin.com/jobs/view/1", scrapeBundle: createScrapeBundle() },
    );

    expect(repository.saveScrapeBundle).toHaveBeenCalledWith(job.id, createScrapeBundle());
    expect(repository.updateStatus).toHaveBeenCalledWith(job.id, "scraped");
    expect(addOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "job-application.analysis-requested" }),
    );
    expect(recordChanged).toHaveBeenCalledOnce();
  });
});
