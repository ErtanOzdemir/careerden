import { describe, expect, it, vi } from "vitest";
import { ScrapeFailureError } from "@careerden/domain";
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

  it("rejects guest HTML without exposed job description text", () => {
    expect(() =>
      parseLinkedInGuestJobDetailHtml("<h1>Sign in</h1>", {
        finalUrl: "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/1",
        sourceUrl: "https://www.linkedin.com/jobs/view/1",
        strategy: "guest",
      }),
    ).toThrow("LinkedIn public job details were not exposed");
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

  it.each([
    [999, "blocked"],
    [403, "blocked"],
    [429, "rate_limited"],
    [404, "not_found"],
    [503, "network"],
  ] as const)("classifies a guest %i response as %s", async (status, category) => {
    const scraper = new LinkedInJobScraper({
      // The Response constructor rejects LinkedIn's non-standard 999, which real fetch delivers.
      fetch: async () => ({ ok: false, status, statusText: "Refused" }) as Response,
    });

    await expect(
      scraper.scrapeJob("https://www.linkedin.com/jobs/view/4300011451"),
    ).rejects.toMatchObject({ category, name: "ScrapeFailureError", statusCode: status });
  });

  it("classifies a request that never reached LinkedIn as a network failure", async () => {
    const scraper = new LinkedInJobScraper({
      fetch: async () => {
        throw new TypeError("fetch failed");
      },
    });

    await expect(
      scraper.scrapeJob("https://www.linkedin.com/jobs/view/4300011451"),
    ).rejects.toMatchObject({ category: "network" });
  });

  it("logs a page whose layout it does not recognize", async () => {
    const warn = vi.fn();
    const scraper = new LinkedInJobScraper({
      fetch: async () => new Response("<html><body>New layout</body></html>", { status: 200 }),
      logger: { warn },
    });

    await expect(
      scraper.scrapeJob("https://www.linkedin.com/jobs/view/4300011451"),
    ).rejects.toMatchObject({ category: "parse" });
    expect(warn).toHaveBeenCalledWith("LinkedIn page did not match the expected structure", {
      adapter: "linkedin-job",
      parserVersion: linkedInGuestParserVersion,
      url: `${linkedinGuestJobDetailEndpoint}/4300011451`,
      detail: "LinkedIn public job details were not exposed: page layout not recognized",
    });
  });

  it("gives up on a guest request that does not answer in time", async () => {
    const scraper = new LinkedInJobScraper({
      fetch: async (_input, init) => {
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        throw new DOMException("The operation timed out.", "TimeoutError");
      },
    });

    await expect(
      scraper.scrapeJob("https://www.linkedin.com/jobs/view/4300011451"),
    ).rejects.toMatchObject({ category: "network" });
  });

  it("classifies a URL without a job id as a parse failure", async () => {
    await expect(
      new LinkedInJobScraper().scrapeJob("https://www.linkedin.com/jobs/collections/"),
    ).rejects.toMatchObject({ category: "parse" });
  });
});

describe("parseLinkedInGuestJobDetailHtml failures", () => {
  const input = {
    finalUrl: "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/1",
    sourceUrl: "https://www.linkedin.com/jobs/view/1",
    strategy: "guest",
  } as const;

  function parseFailure(html: string): ScrapeFailureError {
    try {
      parseLinkedInGuestJobDetailHtml(html, input);
    } catch (error) {
      if (error instanceof ScrapeFailureError) return error;
      throw error;
    }
    throw new Error("Expected the parser to reject the HTML");
  }

  it("classifies an authentication wall as blocked", () => {
    expect(parseFailure("<h1>Sign in to view this job</h1>").category).toBe("blocked");
  });

  it("classifies an unrecognized page layout as a parse failure", () => {
    expect(parseFailure("<main><p>Something new</p></main>").category).toBe("parse");
  });

  it("classifies a recognized posting without description text as empty", () => {
    expect(
      parseFailure(
        '<h1 class="top-card-layout__title">Backend Engineer</h1><div class="show-more-less-html__markup"> </div>',
      ).category,
    ).toBe("empty_description");
  });
});
