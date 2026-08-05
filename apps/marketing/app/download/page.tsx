import type { Metadata } from "next";
import { ArrowRight, Check, FileText, ShieldCheck, Sparkles } from "lucide-react";
import {
  DesktopDownloadGrid,
  DetectedDownloadButton,
} from "@/components/desktop-download-selector";
import { GitHubMark } from "@/components/GitHubMark";
import { desktopRelease } from "@/lib/desktop-release";
import { pageMetadata } from "@/lib/metadata";
import { githubUrl } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Download Careerden for Desktop",
  description:
    "Download Careerden for macOS, Windows, or Linux. The right desktop installer is selected automatically for your operating system.",
  path: "/download",
});

const highlights = [
  {
    Icon: Sparkles,
    title: "A calmer job search",
    description:
      "Applications, follow-ups, match insights, and documents in one focused workspace.",
  },
  {
    Icon: ShieldCheck,
    title: "Your data stays yours",
    description: "Open source, profile-aware, and designed as a dedicated desktop application.",
  },
  {
    Icon: FileText,
    title: "Documents built in",
    description: "Review and edit tailored CV and cover-letter drafts beside every application.",
  },
] as const;

export default function DownloadPage() {
  return (
    <main className="download-main" id="main-content">
      <section className="download-hero">
        <div className="download-hero-orb download-hero-orb-left" />
        <div className="download-hero-orb download-hero-orb-right" />
        <div className="container download-hero-inner">
          <span className="download-eyebrow">
            <span />
            Careerden desktop · v{desktopRelease.version}
          </span>
          <h1>
            Your job search,
            <br />
            <span>now on desktop.</span>
          </h1>
          <p className="download-hero-lede">
            Track every application, remember every follow-up, and prepare tailored documents
            without losing the thread.
          </p>

          <DetectedDownloadButton />

          <a className="download-all-link" href="#all-downloads">
            See all downloads <span aria-hidden="true">↓</span>
          </a>
        </div>
      </section>

      <section className="download-all section-pad" aria-labelledby="all-downloads-title">
        <div className="container">
          <div className="download-section-heading">
            <div>
              <span className="kicker">All platforms</span>
              <h2 id="all-downloads-title">Download Careerden.</h2>
            </div>
            <p>
              Version {desktopRelease.version} is available for macOS, Windows, and Linux. Choose
              the package that matches your computer.
            </p>
          </div>

          <DesktopDownloadGrid />

          <div className="download-release-links">
            <p>
              <Check aria-hidden="true" />
              macOS downloads support Apple silicon and Intel.
            </p>
            <div>
              <a href={desktopRelease.releaseNotesUrl} rel="noreferrer" target="_blank">
                Release notes <ArrowRight aria-hidden="true" />
              </a>
              <a href={githubUrl} rel="noreferrer" target="_blank">
                <GitHubMark />
                View source
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="download-highlights section-pad">
        <div className="container">
          <div className="download-highlight-grid">
            {highlights.map(({ Icon, title, description }) => (
              <article key={title}>
                <Icon aria-hidden="true" />
                <h2>{title}</h2>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="download-source-callout">
        <div className="container">
          <div>
            <span className="kicker">Free and open source</span>
            <h2>Built in the open, for your next move.</h2>
          </div>
          <a
            className="button button-light button-large"
            href={githubUrl}
            rel="noreferrer"
            target="_blank"
          >
            <GitHubMark />
            Explore Careerden on GitHub
          </a>
        </div>
      </section>
    </main>
  );
}
