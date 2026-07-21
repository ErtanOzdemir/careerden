import type { Metadata } from "next";
import { Apple, Download, MonitorDown, Package, Terminal } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { GitHubMark } from "@/components/GitHubMark";
import { pageMetadata } from "@/lib/metadata";
import { desktopDownloadPlaceholderUrl, githubUrl } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Download Careerden for Desktop",
  description:
    "Download the Careerden desktop job application tracker for macOS, Windows, or Linux. Installer links are currently preview placeholders.",
  path: "/download",
});

const platforms = [
  {
    name: "macOS",
    format: "DMG",
    description: "A macOS disk-image packaging target is configured for the desktop application.",
    Icon: Apple,
  },
  {
    name: "Windows",
    format: "NSIS installer",
    description: "A Windows installer packaging target is configured for the desktop application.",
    Icon: MonitorDown,
  },
  {
    name: "Linux",
    format: "AppImage",
    description: "A portable Linux AppImage target is configured for the desktop application.",
    Icon: Terminal,
  },
] as const;

export default function DownloadPage() {
  return (
    <main className="download-main" id="main-content">
      <section className="download-hero section-pad">
        <div className="container download-hero-grid">
          <div className="download-hero-copy">
            <span className="kicker">Careerden desktop</span>
            <h1>Download your job application tracker.</h1>
            <p>
              Bring application tracking, follow-ups, job context, match insights, and editable CV
              and cover-letter drafts into one desktop workspace.
            </p>
            <div className="download-actions">
              <a className="button button-primary button-large" href="#desktop-downloads">
                Choose your platform <span aria-hidden="true">↓</span>
              </a>
              <a
                className="button button-outline button-large"
                href={githubUrl}
                rel="noreferrer"
                target="_blank"
              >
                <GitHubMark />
                View Careerden on GitHub
              </a>
            </div>
            <p className="download-release-note">
              Preview download page · Installers are not published yet
            </p>
          </div>

          <div className="download-product-card" aria-label="Careerden desktop release preview">
            <div className="download-product-brand">
              <BrandMark />
              <div>
                <strong>Careerden</strong>
                <span>Desktop application</span>
              </div>
              <small>Release preview</small>
            </div>
            <div className="download-product-message">
              <Package aria-hidden="true" />
              <div>
                <strong>One workspace for the whole application</strong>
                <p>Track progress first. Use matching and tailored documents when they help.</p>
              </div>
            </div>
            <ul>
              <li>Job application pipeline and follow-ups</li>
              <li>Desktop-assisted LinkedIn capture</li>
              <li>Profile-aware CV and cover-letter workflow</li>
            </ul>
            <p className="download-targets">Packaging configured for macOS, Windows, and Linux</p>
          </div>
        </div>
      </section>

      <section className="download-platforms section-pad" id="desktop-downloads">
        <div className="container">
          <div className="section-heading centered">
            <span className="kicker">Desktop packages</span>
            <h2>Choose your platform.</h2>
            <p>
              The project contains packaging targets for these systems. The buttons currently open
              the release placeholder below rather than downloading an unpublished installer.
            </p>
          </div>

          <div className="download-platform-grid">
            {platforms.map(({ name, format, description, Icon }) => (
              <article key={name}>
                <span className="download-platform-icon">
                  <Icon aria-hidden="true" />
                </span>
                <small>{name}</small>
                <h3>{format}</h3>
                <p>{description}</p>
                <a
                  className="button button-outline download-platform-action"
                  href={desktopDownloadPlaceholderUrl}
                >
                  <Download aria-hidden="true" />
                  Preview {name} download
                </a>
              </article>
            ))}
          </div>

          <div
            className="download-placeholder"
            id="installer-coming-soon"
            role="note"
            aria-labelledby="installer-coming-soon-title"
          >
            <span className="download-placeholder-icon">
              <Package aria-hidden="true" />
            </span>
            <div>
              <span className="kicker">Mock download link</span>
              <h2 id="installer-coming-soon-title">Desktop installers are coming soon.</h2>
              <p id="installer-coming-soon-description">
                No public installer artifacts are available yet. These preview buttons will be
                replaced with verified release links after packaging, signing, and release checks
                are complete.
              </p>
            </div>
            <a href={githubUrl} rel="noreferrer" target="_blank">
              Follow Careerden on GitHub <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
