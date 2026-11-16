import { describe, expect, it } from "vitest";
import { unpluggedRelease } from "./desktop-release";
import {
  blogPostingJsonLd,
  faqPageJsonLd,
  organizationJsonLd,
  serializeJsonLd,
  softwareApplicationJsonLd,
  websiteJsonLd,
} from "./structured-data";
import { githubUrl, siteUrl } from "./site";

describe("structured data", () => {
  it("describes the organization and website with absolute, linked identifiers", () => {
    const organization = organizationJsonLd();
    const website = websiteJsonLd();

    expect(organization).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Careerden",
      sameAs: [githubUrl],
    });
    expect(String(organization.logo).startsWith(siteUrl)).toBe(true);
    expect(website).toMatchObject({
      "@type": "WebSite",
      inLanguage: "en",
      publisher: { "@id": organization["@id"] },
    });
  });

  it("describes the free desktop app with its supported platforms and current version", () => {
    expect(softwareApplicationJsonLd()).toMatchObject({
      "@type": "SoftwareApplication",
      name: "Careerden Unplugged",
      operatingSystem: "macOS",
      softwareVersion: unpluggedRelease.version,
      codeRepository: githubUrl,
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    });
  });

  it("describes a blog post as an article published by the organization", () => {
    const post = {
      slug: "a-post",
      path: "/blog/a-post",
      title: "A post",
      description: "What the post covers.",
      publishedAt: "2026-11-16",
      html: "<p>Body</p>",
    } as const;

    expect(blogPostingJsonLd(post)).toMatchObject({
      "@type": "BlogPosting",
      headline: "A post",
      url: `${siteUrl}/blog/a-post`,
      datePublished: "2026-11-16",
      dateModified: "2026-11-16",
      publisher: { "@id": organizationJsonLd()["@id"] },
    });
    expect(blogPostingJsonLd({ ...post, updatedAt: "2026-12-01" })).toMatchObject({
      dateModified: "2026-12-01",
    });
  });

  it("maps FAQ entries to questions with accepted answers", () => {
    expect(faqPageJsonLd([["Is it free?", "Yes."]])).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Is it free?",
          acceptedAnswer: { "@type": "Answer", text: "Yes." },
        },
      ],
    });
  });

  it("serializes without characters that could close the inline script element", () => {
    const lineSeparator = String.fromCharCode(0x2028);
    const answer = `a & b${lineSeparator}`;
    const serialized = serializeJsonLd(faqPageJsonLd([["</script><b>", answer]]));

    expect(serialized).not.toMatch(/[<>&]/);
    expect(serialized).not.toContain(lineSeparator);
    expect(serialized).toContain("\\u003c/script\\u003e");
    expect(JSON.parse(serialized)).toMatchObject({
      mainEntity: [{ name: "</script><b>", acceptedAnswer: { text: answer } }],
    });
  });
});
