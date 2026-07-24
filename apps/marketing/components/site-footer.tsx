import Link from "next/link";
import { contactEmail, githubUrl } from "@/lib/site";
import { BrandMark } from "./brand-mark";
import { GitHubMark } from "./GitHubMark";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-intro">
          <Link className="brand" href="/" aria-label="Careerden home">
            <BrandMark inverse />
            <span>Careerden</span>
          </Link>
          <p>
            An open-source desktop job application tracker with a profile-aware CV creator and cover
            letter creator, keeping follow-ups, match insights, and tailored documents together.
          </p>
          <a
            aria-label="View Careerden on GitHub"
            className="footer-github-link"
            href={githubUrl}
            rel="noreferrer"
            target="_blank"
          >
            <GitHubMark />
            <span>Careerden on GitHub</span>
          </a>
        </div>
        <nav aria-label="Product links">
          <h2>Product</h2>
          <Link href="/#application-tracking">Job application tracker</Link>
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/#application-pack">Application pack</Link>
          <Link href="/download">Download</Link>
          <Link href="/#faq">FAQ</Link>
        </nav>
        <nav aria-label="Legal links">
          <h2>Legal</h2>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/cookies">Cookie Policy</Link>
          <Link href="/terms">Terms of Service</Link>
          <Link href="/gdpr">GDPR &amp; data rights</Link>
          <Link href="/data-deletion">Account &amp; data deletion</Link>
        </nav>
        <div className="footer-contact">
          <h2>Contact</h2>
          <p>{contactEmail}</p>
          <p className="review-note">Business details require owner review.</p>
        </div>
      </div>
      <div className="container footer-bottom">
        <p>© {new Date().getFullYear()} Careerden. Licensed under AGPL-3.0.</p>
        <p>
          LinkedIn is a trademark of LinkedIn Corporation. Careerden is not affiliated with
          LinkedIn.
        </p>
      </div>
    </footer>
  );
}
