import { describe, expect, it, vi } from "vitest";
import {
  createJobApplicationRepository,
  createProfiles,
  createTestJobApplication,
} from "./job-application-test-helpers.js";
import { RenewScrapeClaimUseCase } from "./renew-scrape-claim.use-case.js";

describe("RenewScrapeClaimUseCase", () => {
  it("renews an owned scrape claim for ten minutes", async () => {
    const job = createTestJobApplication({ scrapeClaimedBy: "desktop-a" });
    const repository = createJobApplicationRepository({
      findById: vi.fn(async () => job),
      renewScrapeClaim: vi.fn(async () => job),
    });

    await new RenewScrapeClaimUseCase(repository, createProfiles()).execute(
      job.id,
      "user-1",
      "desktop-a",
    );

    expect(repository.renewScrapeClaim).toHaveBeenCalledWith(job.id, {
      claimedBy: "desktop-a",
      claimDurationMs: 600_000,
    });
  });
});
