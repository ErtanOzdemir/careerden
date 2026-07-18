import type { ReactNode } from "react";
import Link from "next/link";

export type LegalSection = { id: string; title: string; content: ReactNode };

export function LegalPage({
  eyebrow,
  title,
  summary,
  sections,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  sections: LegalSection[];
}) {
  return (
    <main id="main-content" className="legal-main">
      <div className="container legal-layout">
        <aside className="legal-nav" aria-label={`${title} sections`}>
          <p>On this page</p>
          {sections.map((section) => (
            <a key={section.id} href={`#${section.id}`}>
              {section.title}
            </a>
          ))}
        </aside>
        <article className="legal-article">
          <header className="legal-header">
            <span className="kicker">{eyebrow}</span>
            <h1>{title}</h1>
            <p>{summary}</p>
            <div className="legal-review" role="note">
              <strong>Legal review required</strong>
              <span>
                This working copy describes the intended product behavior. Company-specific terms,
                dates, providers, retention periods, contacts, and governing law remain explicit
                placeholders until confirmed by the owner and legal counsel.
              </span>
            </div>
            <p className="updated">Draft last updated: 18 July 2026</p>
          </header>
          {sections.map((section) => (
            <section id={section.id} className="legal-section" key={section.id}>
              <h2>{section.title}</h2>
              {section.content}
            </section>
          ))}
          <div className="legal-related">
            <strong>Related information</strong>
            <div>
              <Link href="/privacy">Privacy</Link>
              <Link href="/cookies">Cookies</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/gdpr">Data rights</Link>
              <Link href="/data-deletion">Deletion</Link>
            </div>
          </div>
        </article>
      </div>
    </main>
  );
}

export function Placeholder({ children }: { children: ReactNode }) {
  return <mark className="placeholder">{children}</mark>;
}
