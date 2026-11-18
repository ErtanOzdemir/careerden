import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/legal-page";
import { pageMetadata } from "@/lib/metadata";
import { contactEmail } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Cookie Policy",
  description: "The Careerden website sets no cookies and uses cookieless, self-hosted analytics.",
  path: "/cookies",
});

const sections: LegalSection[] = [
  {
    id: "none",
    title: "No cookies",
    content: (
      <p>
        The careerden.app website sets no cookies and stores nothing in your browser&apos;s local
        storage. That is why there is no cookie banner.
      </p>
    ),
  },
  {
    id: "analytics",
    title: "Analytics without cookies",
    content: (
      <p>
        We count visits with our own copy of Umami, which works without cookies or any identifier
        stored on your device and does not store your IP address. The{" "}
        <a href="/privacy#website">Privacy Policy</a> lists exactly what it records.
      </p>
    ),
  },
  {
    id: "third-party",
    title: "Other sites",
    content: (
      <p>
        Installer downloads and links to the source code go to GitHub, which may set its own cookies
        under its own policy once you are on its site.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Questions",
    content: (
      <p>
        Questions about this policy can go to <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
      </p>
    ),
  },
];

export default function CookiesPage() {
  return (
    <LegalPage
      eyebrow="Browser data"
      title="Cookie Policy"
      summary="What the Careerden website stores in your browser: nothing."
      sections={sections}
      updated="18 November 2026"
      draft={false}
    />
  );
}
