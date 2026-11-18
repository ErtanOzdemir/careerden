import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/legal-page";
import { pageMetadata } from "@/lib/metadata";
import { contactEmail } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "GDPR and Data Rights",
  description:
    "How to exercise your privacy rights under the GDPR, UK GDPR, and KVKK for Careerden.",
  path: "/gdpr",
});

const contactLink = <a href={`mailto:${contactEmail}`}>{contactEmail}</a>;

const sections: LegalSection[] = [
  {
    id: "scope",
    title: "What these rights cover",
    content: (
      <p>
        The rights below apply to the personal data the careerden.app website processes and to
        emails you send us, as described in the <a href="/privacy">Privacy Policy</a>. Data in the
        Careerden Unplugged desktop app stays on your computer, so we hold none of it and you
        control it directly.
      </p>
    ),
  },
  {
    id: "rights",
    title: "Your rights",
    content: (
      <>
        <p>Depending on where you live, you may ask us to:</p>
        <ul>
          <li>confirm whether we process your personal data and give you a copy;</li>
          <li>correct data that is wrong or incomplete;</li>
          <li>delete your data;</li>
          <li>restrict processing, or stop processing based on our legitimate interests;</li>
          <li>give you your data in a format you can take elsewhere.</li>
        </ul>
        <p>
          These rights have legal limits. For example, we may keep a record that we handled your
          request, or data we need for a legal claim.
        </p>
      </>
    ),
  },
  {
    id: "automated",
    title: "AI and automated decisions",
    content: (
      <p>
        We make no automated decisions about you. AI analysis and drafting in the desktop app run on
        your computer with the AI provider you choose, and you decide what to do with the results.
      </p>
    ),
  },
  {
    id: "request",
    title: "How to make a request",
    content: (
      <>
        <ol>
          <li>Email {contactLink} and say which right you want to use.</li>
          <li>
            We may ask for information to confirm the request is yours, such as replying from the
            email address concerned.
          </li>
          <li>
            We answer within one month, or within 30 days for requests under KVKK. For complex
            requests the GDPR allows up to two more months, and we tell you if we need them.
          </li>
        </ol>
        <p>Requests are free unless they are clearly unfounded or excessive.</p>
      </>
    ),
  },
  {
    id: "complaints",
    title: "Complaints",
    content: (
      <p>
        Please contact us first so we can try to fix the problem. You can also complain to the data
        protection authority in the country where you live or work, or in Türkiye to the Kişisel
        Verileri Koruma Kurulu.
      </p>
    ),
  },
];

export default function GdprPage() {
  return (
    <LegalPage
      eyebrow="Data rights"
      title="GDPR and your data"
      summary="How to see, correct, or delete the personal data Careerden holds about you."
      sections={sections}
      updated="18 November 2026"
      draft={false}
    />
  );
}
