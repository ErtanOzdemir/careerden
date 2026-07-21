import type { Metadata } from "next";
import { LegalPage, Placeholder, type LegalSection } from "@/components/legal-page";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Cookie Policy",
  description:
    "How Careerden intends to use essential cookies and any optional measurement technologies.",
  path: "/cookies",
});

const sections: LegalSection[] = [
  {
    id: "what",
    title: "What cookies are",
    content: (
      <p>
        Cookies and similar browser storage can remember a session, preferences, or measurement
        choices. This policy covers the public marketing website. Careerden is currently presented
        as a desktop-only product, and desktop application storage must be documented separately
        where its behavior differs.
      </p>
    ),
  },
  {
    id: "essential",
    title: "Strictly necessary use",
    content: (
      <>
        <p>
          Security controls and essential site preferences may be necessary to provide features a
          visitor requests. The public website has no login or signup handoff, and its five-step
          workflow preview is static and does not store profile, template, job, or document data in
          browser storage. Desktop authentication and session storage require a separate verified
          inventory.
        </p>
        <p>
          Confirm the production cookie names, domains, duration, SameSite, Secure, and HttpOnly
          settings: <Placeholder>[COOKIE INVENTORY]</Placeholder>.
        </p>
      </>
    ),
  },
  {
    id: "optional",
    title: "Analytics and optional cookies",
    content: (
      <p>
        No analytics or advertising vendor is assumed by this draft. If optional analytics,
        experimentation, embedded media, or advertising is added, document the provider, purpose,
        duration, and legal basis, and obtain consent where required:{" "}
        <Placeholder>[ANALYTICS PROVIDER OR “NONE”]</Placeholder>.
      </p>
    ),
  },
  {
    id: "controls",
    title: "Your controls",
    content: (
      <>
        <p>
          You can clear browser storage and manage cookies in browser settings. Clearing essential
          storage may reset public-site preferences. Desktop application storage is managed
          separately. Before enabling optional technologies, the production service needs a consent
          mechanism appropriate to the regions it serves:{" "}
          <Placeholder>[CONSENT PLATFORM AND REGIONS]</Placeholder>.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "Questions",
    content: (
      <p>
        Cookie questions may be sent to <Placeholder>[PRIVACY CONTACT EMAIL]</Placeholder>. The
        owner should set the policy effective date after the production inventory is verified.
      </p>
    ),
  },
];

export default function CookiesPage() {
  return (
    <LegalPage
      eyebrow="Browser data"
      title="Cookie Policy"
      summary="What the service stores in your browser, what is necessary, and what requires a choice."
      sections={sections}
    />
  );
}
