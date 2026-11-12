import type { Metadata } from "next";
import {
  ArrowRight,
  Cloud,
  FileText,
  HardDrive,
  KeyRound,
  ShieldCheck,
  Sparkles,
  WifiOff,
} from "lucide-react";
import {
  DesktopDownloadGrid,
  DetectedDownloadButton,
} from "@/components/desktop-download-selector";
import { GitHubMark } from "@/components/GitHubMark";
import { JsonLd } from "@/components/json-ld";
import { UnpluggedWordmark } from "@/components/unplugged-badge";
import { formatPlatformNames, unpluggedRelease } from "@/lib/desktop-release";
import { pageMetadata } from "@/lib/metadata";
import { githubUrl } from "@/lib/site";
import { softwareApplicationJsonLd } from "@/lib/structured-data";

export const metadata: Metadata = pageMetadata({
  title: "Download Careerden Unplugged for Desktop",
  description: `Download Careerden Unplugged for ${formatPlatformNames(unpluggedRelease.downloads, "disjunction")}: a free, open-source job application tracker that keeps your data on your computer.`,
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
    description: "Open source, profile-aware, and stored on your own computer.",
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
      <JsonLd data={softwareApplicationJsonLd()} />
      <section className="download-hero">
        <div className="download-hero-orb download-hero-orb-left" aria-hidden="true" />
        <div className="download-hero-orb download-hero-orb-right" aria-hidden="true" />
        <div className="container download-hero-inner">
          <UnpluggedWordmark size="large" />
          <h1>
            Your job search,
            <br />
            <span>on your computer.</span>
          </h1>
          <p className="download-hero-lede">
            Track every application, remember every follow-up, and prepare tailored documents.
            Careerden Unplugged is free, open source, and keeps everything on your device.
          </p>

          <DetectedDownloadButton release={unpluggedRelease} />

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
              <h2 id="all-downloads-title">Download Careerden Unplugged.</h2>
            </div>
            <p>
              Version {unpluggedRelease.version} is available for{" "}
              {formatPlatformNames(unpluggedRelease.downloads)}. Choose the package that matches
              your computer.
            </p>
          </div>

          <DesktopDownloadGrid downloads={unpluggedRelease.downloads} />

          <div className="unplugged-panel" id="unplugged">
            <div>
              <UnpluggedWordmark size="large" />
              <h2>The whole workspace, without a Careerden server.</h2>
              <p>
                Careerden Unplugged is the desktop edition for people who want their job search to
                stay on their own computer, with no account to create.
              </p>
            </div>
            <div>
              <ul>
                <li>
                  <HardDrive aria-hidden="true" />
                  Profile, applications, follow-ups, and PDFs are stored on your computer.
                </li>
                <li>
                  <KeyRound aria-hidden="true" />
                  AI features use your own OpenAI, Anthropic, Gemini, DeepSeek, or OpenRouter key.
                </li>
                <li>
                  <WifiOff aria-hidden="true" />
                  No account, sign-up, or credits.
                </li>
              </ul>
              <a className="button button-primary button-large" href="#all-downloads">
                Download Careerden Unplugged <ArrowRight aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="cloud-soon-card">
            <span className="cloud-soon-icon">
              <Cloud aria-hidden="true" />
            </span>
            <div>
              <span className="kicker">Careerden Cloud · Coming soon</span>
              <h2>Prefer an account and hosted AI credits?</h2>
              <p>
                Careerden Cloud adds sign-in and monthly AI credits, so you can work without your
                own provider key. Your applications, profile, and documents are available from any
                computer you sign in on. Its downloads will appear here when it launches.
              </p>
            </div>
          </div>

          <div className="download-release-links">
            <div>
              <a href={unpluggedRelease.releaseNotesUrl} rel="noreferrer" target="_blank">
                Release notes <ArrowRight aria-hidden="true" />
              </a>
              <a href={githubUrl} rel="noreferrer" target="_blank">
                <GitHubMark />
                View source on GitHub
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
