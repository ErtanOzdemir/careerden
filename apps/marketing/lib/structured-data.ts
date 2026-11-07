import { unpluggedRelease } from "./desktop-release";
import { absoluteUrl, githubUrl, siteDescription, siteName } from "./site";

// schema.org JSON-LD for crawlers. Values describe only public, verified product facts; legal
// entity details stay out until the placeholders in LEGAL_PLACEHOLDERS.md are confirmed.

export type JsonLdObject = { "@context": "https://schema.org"; "@type": string } & Record<
  string,
  unknown
>;

export type FaqEntry = readonly [question: string, answer: string];

const organizationId = absoluteUrl("/#organization");
const websiteId = absoluteUrl("/#website");
const softwareId = absoluteUrl("/#software");

export function organizationJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": organizationId,
    name: siteName,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/handshake-logo.svg"),
    sameAs: [githubUrl],
  };
}

export function websiteJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": websiteId,
    name: siteName,
    url: absoluteUrl("/"),
    description: siteDescription,
    inLanguage: "en",
    publisher: { "@id": organizationId },
  };
}

export function softwareApplicationJsonLd(): JsonLdObject {
  const operatingSystems = [
    ...new Set(unpluggedRelease.downloads.map((download) => download.platformName)),
  ];
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": softwareId,
    name: `${siteName} Unplugged`,
    alternateName: siteName,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Job application tracker",
    operatingSystem: operatingSystems.join(", "),
    softwareVersion: unpluggedRelease.version,
    url: absoluteUrl("/"),
    downloadUrl: absoluteUrl("/download"),
    codeRepository: githubUrl,
    license: "https://www.gnu.org/licenses/agpl-3.0.html",
    isAccessibleForFree: true,
    description:
      "An open-source desktop job application tracker with a profile-aware CV creator and cover letter creator for managing statuses, follow-ups, job context, match insights, and tailored documents.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: { "@id": organizationId },
  };
}

export function faqPageJsonLd(faqs: readonly FaqEntry[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
}

// JSON.stringify does not escape "<", so a value containing "</script>" could end the inline
// script element early. Unicode-escape the characters that matter inside HTML.
const lineSeparator = new RegExp(String.fromCharCode(0x2028), "g");
const paragraphSeparator = new RegExp(String.fromCharCode(0x2029), "g");

export function serializeJsonLd(data: JsonLdObject | readonly JsonLdObject[]): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(lineSeparator, "\\u2028")
    .replace(paragraphSeparator, "\\u2029");
}
