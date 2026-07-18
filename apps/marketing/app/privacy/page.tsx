import type { Metadata } from "next";
import { LegalPage, Placeholder, type LegalSection } from "@/components/legal-page";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description: "How Link2CV is intended to collect, use, store, share, and protect personal data.",
  path: "/privacy",
});

const sections: LegalSection[] = [
  {
    id: "controller",
    title: "Who is responsible",
    content: (
      <>
        <p>
          The intended data controller is{" "}
          <Placeholder>[LEGAL COMPANY NAME, REGISTRATION NUMBER, AND ADDRESS]</Placeholder>. Privacy
          questions may be sent to <Placeholder>[PRIVACY CONTACT EMAIL]</Placeholder>. The owner
          must confirm whether different entities act as controller for hosted, desktop, or
          enterprise use.
        </p>
      </>
    ),
  },
  {
    id: "collection",
    title: "Data we expect to collect",
    content: (
      <>
        <p>Depending on how you use Link2CV, the service may process:</p>
        <ul>
          <li>
            account details, such as name, email address, authentication records, and security
            events;
          </li>
          <li>
            profile content, including contact details, summary, skills, experience, education,
            projects, certifications, and templates you upload;
          </li>
          <li>
            job and company information captured from URLs you submit, plus raw and normalized
            scrape results;
          </li>
          <li>
            match analysis, prompts or structured AI inputs, generated CV and cover-letter content,
            edits, and rendered files;
          </li>
          <li>
            application workflow state, events, reminders, preferences, and support messages; and
          </li>
          <li>
            technical information such as IP address, device/browser data, request logs, and
            essential cookie identifiers.
          </li>
        </ul>
        <p>Do not submit sensitive personal information that is unnecessary for an application.</p>
      </>
    ),
  },
  {
    id: "purposes",
    title: "Why data is used",
    content: (
      <>
        <p>
          The intended purposes are to authenticate users; store and manage profiles; retrieve
          user-requested job information; analyze role fit; generate, edit, render, store, and
          deliver documents; operate reminders; provide support; secure and troubleshoot the
          service; and meet legal obligations.
        </p>
        <p>
          The lawful bases for each purpose require confirmation:{" "}
          <Placeholder>
            [GDPR LAWFUL-BASIS MATRIX: CONTRACT, LEGITIMATE INTERESTS, CONSENT, AND/OR LEGAL
            OBLIGATION]
          </Placeholder>
          .
        </p>
      </>
    ),
  },
  {
    id: "ai",
    title: "AI processing",
    content: (
      <>
        <p>
          Profile and job information relevant to a request may be sent to configured AI providers
          to extract requirements, assess alignment, or draft application content. AI output can be
          inaccurate and must be reviewed. The service should not use your content to train provider
          models unless the selected provider terms and configuration explicitly allow it and the
          owner gives clear notice.
        </p>
        <p>
          Provider choices, regions, retention, and training controls:{" "}
          <Placeholder>
            [CONFIRM EACH AI PROVIDER, MODEL, REGION, RETENTION SETTING, AND DATA-USE TERMS]
          </Placeholder>
          .
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Processors and recipients",
    content: (
      <>
        <p>
          Expected categories include hosting, PostgreSQL database, Redis queue, S3-compatible
          object storage, document rendering, AI model, email/notification, logging, security, and
          customer-support providers. A current subprocessor list must be published at{" "}
          <Placeholder>[SUBPROCESSOR LIST URL]</Placeholder> before launch.
        </p>
        <p>
          Data may also be disclosed when required by law, to protect people or the service, or
          during a properly governed business transaction.
        </p>
      </>
    ),
  },
  {
    id: "transfers",
    title: "International transfers",
    content: (
      <>
        <p>
          Provider locations and transfer mechanisms have not yet been confirmed. Before launch,
          document where data is processed and the applicable safeguards, such as adequacy decisions
          or standard contractual clauses:{" "}
          <Placeholder>[TRANSFER COUNTRIES AND SAFEGUARDS]</Placeholder>.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "Retention",
    content: (
      <>
        <p>
          Keep personal data only as long as needed for the stated purposes, security, disputes, and
          legal obligations. The owner must approve a schedule for accounts, profiles, raw scrapes,
          generated files, logs, backups, support records, and deleted-account remnants:{" "}
          <Placeholder>[RETENTION SCHEDULE AND BACKUP DELETION WINDOW]</Placeholder>.
        </p>
      </>
    ),
  },
  {
    id: "rights",
    title: "Your choices and rights",
    content: (
      <>
        <p>
          Depending on your location, you may have rights to access, correct, delete, restrict,
          object, port your data, withdraw consent, or complain to a supervisory authority. See{" "}
          <a href="/gdpr">GDPR and data rights</a> and{" "}
          <a href="/data-deletion">account and data deletion</a>.
        </p>
        <p>
          Request channel and identity-verification process:{" "}
          <Placeholder>[DATA-RIGHTS EMAIL OR REQUEST PORTAL]</Placeholder>.
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "Security and changes",
    content: (
      <>
        <p>
          Link2CV should use proportionate technical and organizational safeguards, but no service
          can promise absolute security. The owner must document confirmed controls and incident
          contacts rather than making unverified guarantees.
        </p>
        <p>
          Material policy changes should be dated and communicated through{" "}
          <Placeholder>[NOTICE METHOD AND ADVANCE-NOTICE PERIOD]</Placeholder>.
        </p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="Privacy Policy"
      summary="A transparent working description of the personal data Link2CV needs to provide its profile-aware application workflow."
      sections={sections}
    />
  );
}
