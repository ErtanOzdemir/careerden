import type { Metadata } from "next";
import { LegalPage, Placeholder, type LegalSection } from "@/components/legal-page";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Terms of Service",
  description: "Draft terms governing access to and use of the Careerden service.",
  path: "/terms",
});

const sections: LegalSection[] = [
  {
    id: "agreement",
    title: "Agreement and operator",
    content: (
      <p>
        These draft terms would form an agreement between you and{" "}
        <Placeholder>[LEGAL COMPANY NAME, JURISDICTION, REGISTRATION NUMBER, ADDRESS]</Placeholder>.
        They are not effective until approved, dated, and published by the service owner.
      </p>
    ),
  },
  {
    id: "service",
    title: "The service",
    content: (
      <p>
        Careerden helps users maintain a professional profile, capture job information they submit,
        analyze alignment, organize applications, and draft or render CV and cover-letter materials.
        Features may change. Careerden does not promise employment, interviews, a particular match
        result, or uninterrupted availability.
      </p>
    ),
  },
  {
    id: "accounts",
    title: "Accounts and acceptable use",
    content: (
      <>
        <p>
          You are responsible for accurate registration details, account security, activity under
          your account, and ensuring that you have the right to submit content and job URLs. Do not
          misuse the service, bypass security, disrupt infrastructure, upload malware, violate
          third-party rights or site terms, or use generated content deceptively.
        </p>
        <p>
          Minimum age and eligibility:{" "}
          <Placeholder>[AGE REQUIREMENT AND ELIGIBLE MARKETS]</Placeholder>.
        </p>
      </>
    ),
  },
  {
    id: "content",
    title: "Your content and generated drafts",
    content: (
      <>
        <p>
          You retain whatever rights you hold in content you submit. A limited license is needed to
          process, store, reproduce, transform, and transmit that content solely to operate and
          improve the requested service, subject to the Privacy Policy.
        </p>
        <p>
          AI-generated drafts may be inaccurate, incomplete, or similar to other output. You must
          verify facts, suitability, and rights before use. Ownership language for generated output
          requires counsel review:{" "}
          <Placeholder>[OUTPUT RIGHTS AND PROVIDER-TERM ALIGNMENT]</Placeholder>.
        </p>
      </>
    ),
  },
  {
    id: "ai-output",
    title: "AI-generated output",
    content: (
      <>
        <p>
          Careerden uses artificial intelligence to analyze job postings and to draft CVs, cover
          letters, and suggestions. AI output can contain mistakes, omit relevant information, or
          state experience, qualifications, certifications, or figures that are not in your profile.
          Job postings come from third parties and may contain text designed to influence the AI;
          Careerden takes steps to limit this but cannot guarantee that output is unaffected.
        </p>
        <p>
          Every generated document is a draft. You must check every line before you send, submit, or
          rely on it, and you are solely responsible for the accuracy of anything you send in your
          name. Do not submit claims you cannot support.
        </p>
      </>
    ),
  },
  {
    id: "third-parties",
    title: "Third-party services",
    content: (
      <p>
        LinkedIn, AI providers, storage, rendering, and other third-party services have their own
        terms and availability. You are responsible for complying with applicable third-party terms.
        Careerden is not affiliated with or endorsed by LinkedIn.
      </p>
    ),
  },
  {
    id: "payment",
    title: "Plans, payment, and cancellation",
    content: (
      <p>
        The current recurring subscription is $10 USD per month, may have taxes added at checkout,
        and grants 100 credits for each confirmed paid period. Before accepting production payments,
        confirm the complete plan scope, taxes, renewals, cancellation, refunds, trials, and
        price-change notice: <Placeholder>[FINAL BILLING TERMS]</Placeholder>.
      </p>
    ),
  },
  {
    id: "termination",
    title: "Suspension and termination",
    content: (
      <p>
        Define when users may close accounts, when the operator may suspend or terminate access,
        notice and appeal processes, and what happens to data afterward:{" "}
        <Placeholder>[TERMINATION POLICY]</Placeholder>. Deletion handling should align with the
        Privacy Policy and retention schedule.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Disclaimers and liability",
    content: (
      <p>
        Any warranty disclaimer, liability cap, indemnity, and consumer-law carve-outs must be
        tailored by qualified counsel to the markets served:{" "}
        <Placeholder>[COUNSEL-APPROVED WARRANTY, LIABILITY, AND INDEMNITY LANGUAGE]</Placeholder>.
        Nothing should exclude rights that cannot lawfully be excluded.
      </p>
    ),
  },
  {
    id: "law",
    title: "Governing law and contact",
    content: (
      <p>
        Governing law, courts or dispute process, notice method, and service contact remain to be
        confirmed:{" "}
        <Placeholder>[GOVERNING LAW, VENUE, DISPUTE PROCESS, AND LEGAL CONTACT]</Placeholder>.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Service terms"
      title="Terms of Service"
      summary="The rules, responsibilities, and important limitations that should govern use of Careerden."
      sections={sections}
    />
  );
}
