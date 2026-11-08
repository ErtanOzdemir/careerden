import { describe, expect, it } from "vitest";
import {
  chooseExternalCompanyWebsiteUrl,
  chooseLinkedInCompanyLogoUrl,
  LinkedInCompanyScraper,
  linkedInGuestCompanyParserVersion,
  normalizeLinkedInCompanyUrl,
  parseLinkedInGuestCompanyHtml,
} from "./linkedin-company.scraper.js";

describe("LinkedInCompanyScraper", () => {
  it("selects the largest LinkedIn-hosted company logo candidate", () => {
    expect(
      chooseLinkedInCompanyLogoUrl([
        {
          src: "https://media.licdn.com/dms/image/small-logo",
          srcset:
            "https://media.licdn.com/dms/image/small-logo 100w, https://media.licdn.com/dms/image/large-logo 200w",
        },
      ]),
    ).toBe("https://media.licdn.com/dms/image/large-logo");
  });

  it("rejects non-LinkedIn company logo URLs", () => {
    expect(
      chooseLinkedInCompanyLogoUrl([{ src: "https://images.example.com/company.png" }]),
    ).toBeUndefined();
  });

  it("uses a lazy-loaded LinkedIn logo when src is only a placeholder", () => {
    expect(
      chooseLinkedInCompanyLogoUrl([
        {
          src: "data:image/gif;base64,placeholder",
          delayedUrl: "https://media.licdn.com/dms/image/lazy-logo",
        },
      ]),
    ).toBe("https://media.licdn.com/dms/image/lazy-logo");
  });

  it("normalizes LinkedIn company URLs to the public company root", () => {
    expect(
      normalizeLinkedInCompanyUrl(
        "https://www.linkedin.com/company/ogretmenbulun/about/?trk=public_jobs",
      ),
    ).toBe("https://www.linkedin.com/company/ogretmenbulun/");
  });

  it("ignores missing or non-LinkedIn company URLs", () => {
    expect(
      normalizeLinkedInCompanyUrl("https://example.com/company/ogretmenbulun"),
    ).toBeUndefined();
    expect(normalizeLinkedInCompanyUrl("https://www.linkedin.com/jobs/view/123")).toBeUndefined();
  });

  it("extracts a direct external website candidate", () => {
    expect(
      chooseExternalCompanyWebsiteUrl([
        "Website",
        "https://www.linkedin.com/company/ogretmenbulun/about/",
        "https://ogretmenbulun.com",
      ]),
    ).toBe("https://ogretmenbulun.com/");
  });

  it("extracts a website from a LinkedIn redirect URL", () => {
    expect(
      chooseExternalCompanyWebsiteUrl([
        "https://www.linkedin.com/redir/redirect?url=https%3A%2F%2Fogretmenbulun.com%2F",
      ]),
    ).toBe("https://ogretmenbulun.com/");
  });

  it("normalizes host-like website text", () => {
    expect(chooseExternalCompanyWebsiteUrl(["www.ogretmenbulun.com"])).toBe(
      "https://www.ogretmenbulun.com/",
    );
  });

  it("returns undefined when only LinkedIn-internal candidates exist", () => {
    expect(
      chooseExternalCompanyWebsiteUrl([
        "https://www.linkedin.com/company/ogretmenbulun/about/",
        "https://www.linkedin.com/feed/",
      ]),
    ).toBeUndefined();
  });

  it("returns no website without throwing when no LinkedIn company URL is present", async () => {
    const scraper = new LinkedInCompanyScraper();

    const result = await scraper.scrapeCompany({ companyName: "Ogretmen Bulun" });

    expect(result.websiteUrl).toBeUndefined();
    expect(result).toMatchObject({
      name: "Ogretmen Bulun",
      raw: {
        adapter: "linkedin-company",
        websiteExtracted: false,
        reason: "missing_linkedin_company_url",
      },
    });
  });

  it("uses the public company root as the default guest strategy", async () => {
    const fetchCalls: string[] = [];
    const html = `
      <html>
        <head>
          <meta property="og:title" content="Acme | LinkedIn">
          <script type="application/ld+json">
            ${JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  name: "Acme",
                  url: "https://www.linkedin.com/company/acme",
                },
                {
                  "@type": "Organization",
                  name: "Acme Corporation",
                  description: "Acme builds reliable products.",
                  url: "https://www.linkedin.com/company/acme",
                  sameAs: "https://acme.example.com",
                  logo: {
                    "@type": "ImageObject",
                    contentUrl: "https://media.licdn.com/dms/image/company-page-logo",
                  },
                },
              ],
            })}
          </script>
        </head>
      </html>
    `;
    const scraper = new LinkedInCompanyScraper({
      fetch: async (request) => {
        fetchCalls.push(String(request));
        return new Response(html, { status: 200 });
      },
    });

    const result = await scraper.scrapeCompany({
      companyName: "Acme",
      linkedInUrl: "https://www.linkedin.com/company/acme?trk=public_jobs",
      logoUrl: "https://media.licdn.com/dms/image/job-post-logo",
    });

    expect(fetchCalls).toEqual(["https://www.linkedin.com/company/acme/"]);
    expect(result).toMatchObject({
      name: "Acme Corporation",
      linkedInUrl: "https://www.linkedin.com/company/acme/",
      websiteUrl: "https://acme.example.com/",
      description: "Acme builds reliable products.",
      logoUrl: "https://media.licdn.com/dms/image/job-post-logo",
      raw: {
        adapter: "linkedin-company",
        strategy: "guest",
        parserVersion: linkedInGuestCompanyParserVersion,
        companyUrl: "https://www.linkedin.com/company/acme/",
        html,
      },
    });
  });

  it("rejects a guest response that redirects to LinkedIn authentication", async () => {
    const scraper = new LinkedInCompanyScraper({
      fetch: async () =>
        new Response("<html><title>Sign Up | LinkedIn</title></html>", { status: 200 }),
    });

    await expect(
      scraper.scrapeCompany({
        companyName: "Acme",
        linkedInUrl: "https://www.linkedin.com/company/acme",
      }),
    ).rejects.toMatchObject({ category: "blocked", name: "ScrapeFailureError" });
  });

  it.each([
    [999, "blocked"],
    [403, "blocked"],
    [429, "rate_limited"],
    [404, "not_found"],
    [503, "network"],
  ] as const)("classifies a guest %i company response as %s", async (status, category) => {
    const scraper = new LinkedInCompanyScraper({
      // The Response constructor rejects LinkedIn's non-standard 999, which real fetch delivers.
      fetch: async () => ({ ok: false, status, statusText: "Refused" }) as Response,
    });

    await expect(
      scraper.scrapeCompany({
        companyName: "Acme",
        linkedInUrl: "https://www.linkedin.com/company/acme",
      }),
    ).rejects.toMatchObject({ category, name: "ScrapeFailureError" });
  });
});

describe("parseLinkedInGuestCompanyHtml", () => {
  it("falls back to public meta tags and the Website definition", () => {
    const html = `
      <meta property="og:title" content="Acme | LinkedIn">
      <meta property="og:description" content="Acme makes useful tools.">
      <meta property="og:image" content="https://media.licdn.com/dms/image/acme-logo">
      <div data-test-id="about-us__website">
        <dt>Website</dt>
        <dd><a href="https://acme.example.com">Visit website</a></dd>
      </div>
    `;

    expect(
      parseLinkedInGuestCompanyHtml(html, {
        companyUrl: "https://www.linkedin.com/company/acme/",
        finalUrl: "https://www.linkedin.com/company/acme/",
        input: {
          companyName: "Acme fallback",
          linkedInUrl: "https://www.linkedin.com/company/acme",
          logoUrl: "https://media.licdn.com/dms/image/job-post-logo",
        },
        strategy: "guest",
      }),
    ).toMatchObject({
      name: "Acme",
      websiteUrl: "https://acme.example.com/",
      description: "Acme makes useful tools.",
      logoUrl: "https://media.licdn.com/dms/image/job-post-logo",
    });
  });
});
