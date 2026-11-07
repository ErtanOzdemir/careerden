import { describe, expect, it, vi } from "vitest";
import {
  extractLinkedInCompanyLogoUrlFromHtml,
  extractLinkedInJobId,
  htmlToLinkedInJobDescriptionText,
  LinkedInJobScraper,
  linkedinGuestJobDetailEndpoint,
  linkedInGuestParserVersion,
  parseLinkedInGuestJobDetailHtml,
  sanitizeLinkedInJobDescriptionHtml,
} from "./linkedin-job.scraper.js";

const parseInput = {
  finalUrl: "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/1",
  sourceUrl: "https://www.linkedin.com/jobs/view/1",
  strategy: "guest" as const,
};

function silentLogger() {
  return { warn: vi.fn() };
}

describe("extractLinkedInJobDescription", () => {
  it("captures sanitized display HTML and plain text from the LinkedIn description", async () => {
    const html = `
      <h2>About the role</h2>
      <p>Build <strong>TypeScript</strong> services.</p>
      <ul>
        <li>Own APIs</li>
        <li><a href="https://example.com/team" data-tracking-control-name="x">Meet the team</a></li>
      </ul>
      <button>Show more</button>
      <script>window.evil = true</script>
      <p onclick="alert('x')">Ship safely</p>
    `;

    const sanitizedHtml = sanitizeLinkedInJobDescriptionHtml(html);

    expect(htmlToLinkedInJobDescriptionText(html)).toBe(
      "About the role\nBuild TypeScript services.\nOwn APIs\nMeet the team\nShip safely",
    );
    expect(sanitizedHtml).toBe(
      '<h2>About the role</h2><p>Build <strong>TypeScript</strong> services.</p><ul><li>Own APIs</li><li><a href="https://example.com/team">Meet the team</a></li></ul><p>Ship safely</p>',
    );
  });

  it("drops unsafe links while preserving their text", async () => {
    const html = `
      <p><a href="javascript:alert('x')">Apply here</a></p>
    `;

    expect(htmlToLinkedInJobDescriptionText(html)).toBe("Apply here");
    expect(sanitizeLinkedInJobDescriptionHtml(html)).toBe("<p>Apply here</p>");
  });
});

describe("extractLinkedInJobId", () => {
  it("extracts ids from LinkedIn job URLs and URNs", () => {
    expect(extractLinkedInJobId("https://www.linkedin.com/jobs/view/4300011451")).toBe(
      "4300011451",
    );
    expect(
      extractLinkedInJobId(
        "https://www.linkedin.com/jobs/view/software-engineer-at-company-4300011451/",
      ),
    ).toBe("4300011451");
    expect(
      extractLinkedInJobId(
        "https://www.linkedin.com/jobs/search/?currentJobId=4300011451&keywords=engineer",
      ),
    ).toBe("4300011451");
    expect(extractLinkedInJobId("urn:li:jobPosting:4300011451")).toBe("4300011451");
    expect(extractLinkedInJobId("4300011451")).toBe("4300011451");
  });
});

describe("parseLinkedInGuestJobDetailHtml", () => {
  it("normalizes guest detail HTML while preserving the raw payload", () => {
    const html = `
      <main>
        <h1 class="top-card-layout__title">Senior Backend Engineer</h1>
        <a class="topcard__org-name-link" href="https://www.linkedin.com/company/acme/?trk=x">Acme Inc</a>
        <span class="topcard__flavor topcard__flavor--bullet">Berlin, Germany</span>
        <img class="artdeco-entity-image" src="https://media.licdn.com/dms/image/logo.png">
        <div class="show-more-less-html__markup">
          <p>Build <strong>TypeScript</strong> services.</p>
          <ul><li>Own public APIs</li></ul>
        </div>
        <h3 class="description__job-criteria-subheader">Employment type</h3>
        <span class="description__job-criteria-text">Full-time</span>
      </main>
    `;

    const job = parseLinkedInGuestJobDetailHtml(html, {
      finalUrl: `${linkedinGuestJobDetailEndpoint}/4300011451`,
      sourceJobId: "4300011451",
      sourceUrl: "https://www.linkedin.com/jobs/view/4300011451",
      strategy: "guest",
    });

    expect(job).toMatchObject({
      title: "Senior Backend Engineer",
      companyName: "Acme Inc",
      location: "Berlin, Germany",
      description: "Build TypeScript services.\nOwn public APIs",
      descriptionHtml:
        "<p>Build <strong>TypeScript</strong> services.</p><ul><li>Own public APIs</li></ul>",
      requirements: [],
      companyLinkedInUrl: "https://www.linkedin.com/company/acme/",
      companyLogoUrl: "https://media.licdn.com/dms/image/logo.png",
    });
    expect(job.raw).toMatchObject({
      adapter: "linkedin-job",
      strategy: "guest",
      parserVersion: linkedInGuestParserVersion,
      sourceJobId: "4300011451",
      html,
      companyLogoUrl: "https://media.licdn.com/dms/image/logo.png",
      criteria: { "employment type": "Full-time" },
    });
  });

  it("treats a guest sign-in page as blocked", () => {
    expect(() =>
      parseLinkedInGuestJobDetailHtml("<h1>Sign in</h1>", parseInput, silentLogger()),
    ).toThrow(expect.objectContaining({ name: "ScrapingFailure", category: "blocked" }));
  });

  it("reports and logs guest HTML without exposed job description text as a parse failure", () => {
    const logger = silentLogger();

    expect(() => parseLinkedInGuestJobDetailHtml("<h1>Engineer</h1>", parseInput, logger)).toThrow(
      expect.objectContaining({ category: "parse_failed" }),
    );
    expect(logger.warn).toHaveBeenCalledWith("LinkedIn page did not match the expected structure", {
      adapter: "linkedin-job",
      missing: ["description"],
      parserVersion: linkedInGuestParserVersion,
      url: parseInput.finalUrl,
    });
  });
});

describe("extractLinkedInCompanyLogoUrlFromHtml", () => {
  it("selects LinkedIn-hosted logo candidates from image attributes", () => {
    expect(
      extractLinkedInCompanyLogoUrlFromHtml(`
        <img class="base-search-card__entity-image" src="data:image/gif;base64,x"
          data-delayed-url="https://media.licdn.com/dms/image/company-logo.png">
      `),
    ).toBe("https://media.licdn.com/dms/image/company-logo.png");
  });
});

describe("LinkedInJobScraper", () => {
  it("uses the guest endpoint as the default strategy", async () => {
    const fetchCalls: string[] = [];
    const scraper = new LinkedInJobScraper({
      fetch: async (input) => {
        fetchCalls.push(String(input));

        return new Response(
          `
            <h1 class="top-card-layout__title">Frontend Engineer</h1>
            <a class="topcard__org-name-link" href="https://www.linkedin.com/company/acme/">Acme</a>
            <div class="show-more-less-html__markup"><p>Build React apps.</p></div>
          `,
          { status: 200 },
        );
      },
    });

    const job = await scraper.scrapeJob("https://www.linkedin.com/jobs/view/4300011451");

    expect(fetchCalls).toEqual([`${linkedinGuestJobDetailEndpoint}/4300011451`]);
    expect(job.title).toBe("Frontend Engineer");
    expect(job.companyName).toBe("Acme");
  });
});
