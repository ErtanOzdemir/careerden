import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/legal-page";
import { pageMetadata } from "@/lib/metadata";
import { contactEmail } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Deleting Your Data",
  description:
    "How to delete your Careerden data from your computer, and how to ask us to delete website or email data.",
  path: "/data-deletion",
});

const sections: LegalSection[] = [
  {
    id: "app",
    title: "Data in the desktop app",
    content: (
      <>
        <p>
          Careerden Unplugged has no account and keeps everything on your computer, so you delete
          your data yourself and nothing remains with us.
        </p>
        <ul>
          <li>
            To remove a single job application, document, or profile detail, delete or edit it in
            the app.
          </li>
          <li>
            To keep a copy first, use <strong>Settings → Your data → Export data</strong>.
          </li>
          <li>
            To delete everything, open <strong>Settings → Your data → Open data folder</strong>,
            quit the app, and delete the folder that opened. On macOS it is{" "}
            <code>~/Library/Application Support/Careerden Unplugged</code>. This also removes your
            saved AI keys, earlier automatic backups, and logs, and it cannot be undone.
          </li>
        </ul>
        <p>
          Uninstalling the app alone does not delete this folder. Backups you exported elsewhere
          stay where you saved them.
        </p>
      </>
    ),
  },
  {
    id: "providers",
    title: "Data held by your AI provider",
    content: (
      <p>
        Requests the app sent to your AI provider are kept under that provider&apos;s own terms. Ask
        the provider directly if you want them deleted.
      </p>
    ),
  },
  {
    id: "website",
    title: "Website and email data",
    content: (
      <p>
        To delete emails you sent us or any other data described in the{" "}
        <a href="/privacy">Privacy Policy</a>, write to{" "}
        <a href={`mailto:${contactEmail}`}>{contactEmail}</a>. We confirm the request is yours and
        reply within one month. Visit statistics contain no IP address or other detail that lets us
        find your visits, so we cannot single them out for deletion.
      </p>
    ),
  },
];

export default function DataDeletionPage() {
  return (
    <LegalPage
      eyebrow="Your data"
      title="Deleting your data"
      summary="Your Careerden data lives on your computer, so you can delete it yourself at any time."
      sections={sections}
      updated="18 November 2026"
      draft={false}
    />
  );
}
