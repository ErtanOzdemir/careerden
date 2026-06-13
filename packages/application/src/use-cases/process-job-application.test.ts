import { describe, expect, it } from "vitest";
import {
  GenerateDocumentsUseCase,
  ProcessJobApplicationUseCase,
  RunMatchAnalysisUseCase
} from "../index.js";
import type { JobSiteScraper } from "@link2cv/domain";
import {
  InMemoryJobApplicationRepository,
  InMemoryUserProfileRepository,
  LocalHeuristicMatchingProvider
} from "@link2cv/infrastructure";

describe("ProcessJobApplicationUseCase", () => {
  it("moves a job application through the full pipeline", async () => {
    const profiles = new InMemoryUserProfileRepository();
    const jobApplications = new InMemoryJobApplicationRepository();
    const profile = await profiles.create({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      skills: ["TypeScript"],
      experience: [
        {
          company: "Analytical Engines",
          title: "Engineer",
          achievements: ["Built reliable automation"]
        }
      ]
    });
    const jobApplication = await jobApplications.create({
      profileId: profile.id,
      sourceUrl: "https://www.linkedin.com/jobs/view/123"
    });
    const scraper = createScraper();
    const matching = new RunMatchAnalysisUseCase(new LocalHeuristicMatchingProvider(), jobApplications);
    const documents = new GenerateDocumentsUseCase(
      {
        async render() {
          return "<html><body>Document</body></html>";
        }
      },
      {
        async htmlToPdf() {
          return Buffer.from("pdf");
        }
      },
      {
        async put(file) {
          return {
            id: "file-1",
            fileName: file.fileName,
            contentType: file.contentType,
            size: file.body.byteLength
          };
        },
        async getSignedUrl() {
          return "file://file-1";
        }
      },
      jobApplications
    );

    await new ProcessJobApplicationUseCase(
      jobApplications,
      profiles,
      {
        job: scraper,
        companyLinkedIn: scraper,
        companyWebsite: scraper,
        careerPage: scraper
      },
      matching,
      documents
    ).execute(jobApplication.id);

    const completed = await jobApplications.findById(jobApplication.id);
    const generated = await jobApplications.listGeneratedDocuments(jobApplication.id);

    expect(completed?.status).toBe("completed");
    expect(generated).toHaveLength(2);
  });
});

function createScraper(): JobSiteScraper {
  return {
    canHandle() {
      return true;
    },
    async scrapeJob(url) {
      return {
        title: "Backend Engineer",
        companyName: "Example Inc",
        description: "Build TypeScript services",
        requirements: ["TypeScript"],
        companyLinkedInUrl: "https://www.linkedin.com/company/example",
        raw: { url }
      };
    },
    async scrapeCompany(input) {
      return {
        name: input.companyName,
        linkedInUrl: input.linkedInUrl,
        websiteUrl: input.websiteUrl ?? "https://example.com",
        careerPageUrl: "https://example.com/careers",
        raw: input
      };
    }
  };
}
