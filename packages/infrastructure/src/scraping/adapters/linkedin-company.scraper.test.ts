import { describe, expect, it } from "vitest";
import {
  chooseExternalCompanyWebsiteUrl,
  chooseLinkedInAboutWebsiteUrl,
  LinkedInCompanyScraper,
  normalizeLinkedInCompanyAboutUrl,
} from "./linkedin-company.scraper.js";

describe("LinkedInCompanyScraper", () => {
  it("normalizes LinkedIn company URLs to the about page", () => {
    expect(
      normalizeLinkedInCompanyAboutUrl("https://www.linkedin.com/company/ogretmenbulun"),
    ).toBe("https://www.linkedin.com/company/ogretmenbulun/about/");
    expect(
      normalizeLinkedInCompanyAboutUrl("https://www.linkedin.com/company/ogretmenbulun/"),
    ).toBe("https://www.linkedin.com/company/ogretmenbulun/about/");
    expect(
      normalizeLinkedInCompanyAboutUrl("https://www.linkedin.com/company/ogretmenbulun/about/"),
    ).toBe("https://www.linkedin.com/company/ogretmenbulun/about/");
  });

  it("ignores missing or non-LinkedIn company URLs", () => {
    expect(normalizeLinkedInCompanyAboutUrl()).toBeUndefined();
    expect(normalizeLinkedInCompanyAboutUrl("https://example.com/company/ogretmenbulun")).toBeUndefined();
    expect(normalizeLinkedInCompanyAboutUrl("https://www.linkedin.com/jobs/view/123")).toBeUndefined();
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

  it("extracts the website from the LinkedIn about Website definition field", () => {
    expect(
      chooseLinkedInAboutWebsiteUrl([
        { label: "Verified page", text: "September 12, 2023" },
        { label: "Website", href: "https://withcherry.com/", text: "https://withcherry.com/" },
        { label: "Industry", text: "Financial Services" },
      ]),
    ).toBe("https://withcherry.com/");
  });

  it("falls back to Website definition text when no anchor exists", () => {
    expect(
      chooseLinkedInAboutWebsiteUrl([
        { label: "Website", text: "www.withcherry.com" },
      ]),
    ).toBe("https://www.withcherry.com/");
  });

  it("does not infer a website from non-Website definition fields", () => {
    expect(
      chooseLinkedInAboutWebsiteUrl([
        { label: "Industry", text: "Financial Services" },
        { label: "Company size", href: "https://withcherry.com/", text: "851 associated members" },
      ]),
    ).toBeUndefined();
  });

  it("returns undefined when the Website definition field is absent", () => {
    expect(
      chooseLinkedInAboutWebsiteUrl([
        { label: "Verified page", text: "September 12, 2023" },
        { label: "Headquarters", text: "San Francisco, California" },
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

  it("requires a saved LinkedIn session before opening a company about page", async () => {
    const scraper = new LinkedInCompanyScraper();

    await expect(
      scraper.scrapeCompany({
        companyName: "Ogretmen Bulun",
        linkedInUrl: "https://www.linkedin.com/company/ogretmenbulun/about/",
      }),
    ).rejects.toThrow("linkedin_session_required");
  });
});
