import type { Metadata } from "next";
import { LegalPage, Placeholder, type LegalSection } from "@/components/legal-page";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "GDPR and Data Rights",
  description: "How to understand and exercise privacy and GDPR rights relating to Careerden data.",
  path: "/gdpr",
});

const sections: LegalSection[] = [
  {
    id: "scope",
    title: "Scope and roles",
    content: (
      <p>
        This page explains the intended rights process for people covered by the GDPR or UK GDPR.
        The owner must confirm the controller identity, EU/UK establishment, representative
        obligations, and whether Careerden ever acts as a processor for business customers:{" "}
        <Placeholder>[CONTROLLER, REPRESENTATIVE, AND PROCESSOR ROLES]</Placeholder>.
      </p>
    ),
  },
  {
    id: "rights",
    title: "Your rights",
    content: (
      <>
        <p>
          Subject to conditions and exceptions, you may request access to personal data; correction;
          deletion; restriction; objection to processing; portability; and withdrawal of consent.
          You may also complain to your local supervisory authority.
        </p>
        <p>
          These rights are not absolute. The service may need to retain limited data to meet legal
          obligations, establish claims, protect security, or document a completed request.
        </p>
      </>
    ),
  },
  {
    id: "automated",
    title: "AI and automated decisions",
    content: (
      <p>
        Careerden uses AI-supported analysis and drafting, but the intended product leaves
        application decisions and document review to the user. The owner must assess and document
        whether any production processing creates legal or similarly significant solely automated
        decisions: <Placeholder>[ARTICLE 22 ASSESSMENT]</Placeholder>.
      </p>
    ),
  },
  {
    id: "request",
    title: "How to make a request",
    content: (
      <>
        <ol>
          <li>
            Contact <Placeholder>[DATA-RIGHTS EMAIL OR PORTAL]</Placeholder> and describe the right
            you want to exercise.
          </li>
          <li>
            The operator may request proportionate information to verify your identity and protect
            account data.
          </li>
          <li>
            The request will be assessed, scoped across active systems and relevant processors, and
            answered within the legally applicable period.
          </li>
        </ol>
        <p>
          Confirm intake, identity verification, authorized-agent handling, response templates,
          escalation, and request records before launch:{" "}
          <Placeholder>[DATA-SUBJECT REQUEST PROCEDURE]</Placeholder>.
        </p>
      </>
    ),
  },
  {
    id: "timing",
    title: "Timing and fees",
    content: (
      <p>
        GDPR requests are generally answered without undue delay and within one month, subject to
        lawful extensions for complexity or volume. A reasonable fee or refusal may be allowed for
        manifestly unfounded or excessive requests. Counsel should confirm the operational timeline
        for every market served.
      </p>
    ),
  },
  {
    id: "export",
    title: "Access and export",
    content: (
      <p>
        An export may include account and profile data, job-application records, preferences,
        generated content, and other personal data required by law, in a commonly used format where
        portability applies. Confirm the available in-product export and secure delivery process:{" "}
        <Placeholder>[EXPORT SCOPE, FORMAT, AND DELIVERY]</Placeholder>.
      </p>
    ),
  },
  {
    id: "complaints",
    title: "Questions and complaints",
    content: (
      <p>
        Contact the operator first at <Placeholder>[PRIVACY CONTACT]</Placeholder> so it can
        investigate. You retain the right to contact the competent supervisory authority. Identify
        the lead authority only after the operator’s establishment and processing arrangements are
        confirmed: <Placeholder>[LEAD SUPERVISORY AUTHORITY, IF APPLICABLE]</Placeholder>.
      </p>
    ),
  },
];

export default function GdprPage() {
  return (
    <LegalPage
      eyebrow="Data rights"
      title="GDPR and your data"
      summary="A practical overview of privacy rights and the request process intended for Careerden."
      sections={sections}
    />
  );
}
