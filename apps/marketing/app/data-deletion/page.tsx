import type { Metadata } from "next";
import { LegalPage, Placeholder, type LegalSection } from "@/components/legal-page";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Account and Data Deletion",
  description: "How to request deletion of a Link2CV account and associated personal data.",
  path: "/data-deletion",
});

const sections: LegalSection[] = [
  {
    id: "before",
    title: "Before you delete",
    content: (
      <p>
        Account deletion is intended to remove access and begin deletion of associated personal
        data. Export any CVs, cover letters, profile details, or application records you want to
        keep first. Deletion may not be reversible after the stated recovery window:{" "}
        <Placeholder>[RECOVERY WINDOW OR “NO RECOVERY WINDOW”]</Placeholder>.
      </p>
    ),
  },
  {
    id: "request",
    title: "Request account deletion",
    content: (
      <>
        <ol>
          <li>
            Use the desktop application account-deletion control at{" "}
            <Placeholder>[DESKTOP SETTINGS PATH — NOT YET CONFIRMED]</Placeholder>, or contact{" "}
            <Placeholder>[DELETION REQUEST EMAIL]</Placeholder>.
          </li>
          <li>
            Confirm the request using the account session or proportionate identity verification.
          </li>
          <li>
            Receive confirmation when the account is disabled and when deletion from active systems
            is complete.
          </li>
        </ol>
        <p>
          The current product settings do not yet expose a verified self-service deletion control.
          Do not claim otherwise until that workflow is implemented.
        </p>
      </>
    ),
  },
  {
    id: "scope",
    title: "What deletion should cover",
    content: (
      <p>
        Subject to verified production behavior, deletion should cover account/profile records, job
        applications, raw and normalized scrape data, match analyses, generated and uploaded
        documents, stored files, reminders, preferences, and directly identifying support data. The
        public five-step workflow preview uses fictional data and does not create account or
        onboarding records.
      </p>
    ),
  },
  {
    id: "exceptions",
    title: "What may remain",
    content: (
      <p>
        Limited records may remain when required for legal obligations, fraud and security
        prevention, disputes, or proof that a request was fulfilled. Backups may expire on a delayed
        cycle and should not be restored to normal use. Confirm categories, legal bases, access
        restrictions, and time limits:{" "}
        <Placeholder>[DELETION EXCEPTIONS AND BACKUP EXPIRY]</Placeholder>.
      </p>
    ),
  },
  {
    id: "providers",
    title: "Processors and timing",
    content: (
      <p>
        The operator should propagate verified deletion requests to relevant processors unless
        retention is legally required. Publish a realistic completion target based on database,
        object storage, queue, log, backup, AI-provider, email, and support systems:{" "}
        <Placeholder>[ACTIVE-SYSTEM AND BACKUP DELETION TIMELINES]</Placeholder>.
      </p>
    ),
  },
  {
    id: "partial",
    title: "Delete or correct specific data",
    content: (
      <p>
        If you want to keep the account but remove or correct specific profile, application, or
        document information, use available edit/delete controls or make a data-rights request.
        Contact <Placeholder>[DATA-RIGHTS CONTACT]</Placeholder> for records without a self-service
        control.
      </p>
    ),
  },
];

export default function DataDeletionPage() {
  return (
    <LegalPage
      eyebrow="Account controls"
      title="Account and data deletion"
      summary="What to expect when you ask Link2CV to delete an account or specific personal data."
      sections={sections}
    />
  );
}
