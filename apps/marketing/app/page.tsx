import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClock,
  Check,
  HardDrive,
  KeyRound,
  LayoutDashboard,
  Link2,
  ListChecks,
  WifiOff,
} from "lucide-react";
import { GitHubMark } from "@/components/GitHubMark";
import { ProductPreview } from "@/components/product-preview";
import { UnpluggedWordmark } from "@/components/unplugged-badge";
import {
  ApplicationPackWorkflowPreview,
  ApplicationsSortingWorkflowPreview,
  BaseResumeWorkflowPreview,
  JobProcessingWorkflowPreview,
  ProfileWorkflowPreview,
  TailoringTipsWorkflowPreview,
} from "@/components/workflow-preview";
import { pageMetadata } from "@/lib/metadata";
import { absoluteUrl, githubUrl } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Desktop Job Application Tracker & CV Creator",
  description:
    "Careerden is an open-source desktop job application tracker and CV creator for managing statuses, follow-ups, match insights, CVs, and cover letters.",
  path: "/",
});

const faqs = [
  [
    "Does Careerden apply to jobs for me?",
    "No. Careerden helps you track opportunities and prepare application materials. You review the content and decide when and where to apply.",
  ],
  [
    "Will it invent experience to improve my match?",
    "It is designed around the profile information you provide. Always review AI-generated analysis and documents for accuracy before using them.",
  ],
  [
    "What do I need to get started?",
    "Download Careerden Unplugged and complete your career profile. Add your own AI provider key when you want match analysis and tailored documents. The desktop app can capture a LinkedIn posting automatically, or you can paste job details manually. Pick one of six built-in CV layouts on the Base resume page; there are no templates to build or upload.",
  ],
  [
    "Is Careerden only for LinkedIn jobs?",
    "No. Careerden is a job-application tracking workspace. LinkedIn is the automated capture source supported by the desktop helper, and you can paste job and company details manually for applications from any other source.",
  ],
  [
    "What can I track for each application?",
    "Keep the application status, job and company context, salary, work style, interest level, contacts, notes, follow-ups, match analysis, and generated documents together.",
  ],
  [
    "Can I control the output?",
    "Yes. Preview each improvement tip as a suggested change before you accept or discard it, answer gap questions only with facts that are true, edit the CV or cover letter directly, and select Update pack to render the revised PDFs.",
  ],
  [
    "Is Careerden also a CV creator?",
    "Yes. The profile-aware CV creator and cover letter creator use your factual profile and each job's requirements to prepare editable drafts. You review and update every draft before use.",
  ],
  [
    "What is Careerden Unplugged?",
    "Careerden Unplugged is the desktop edition available today. It keeps your profile, applications, and documents on your computer and sends no data to a Careerden server. AI features use your own provider API key, so there are no accounts or credits. A hosted Careerden Cloud edition with accounts and AI credits is coming soon.",
  ],
  [
    "What does a UTC calendar month mean?",
    "It applies to Careerden Cloud, which is coming soon. UTC is the shared global time standard. A calendar month starts at 00:00 UTC on its first day and ends when the next month begins in UTC. Your 10 free credits apply to that shared month—not one month from your signup date—and unused free credits expire at the month boundary. The local reset time depends on your time zone.",
  ],
  [
    "How is my data handled?",
    "Careerden Unplugged stores your profile, applications, and documents on your computer. Job details and profile content are sent only to the AI provider you configure when you run an analysis. The Privacy Policy describes the intended data model for the upcoming cloud edition and the items still awaiting owner and legal confirmation.",
  ],
];

export default function HomePage() {
  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Careerden",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Desktop",
    url: absoluteUrl("/"),
    codeRepository: githubUrl,
    description:
      "An open-source desktop job application tracker with a profile-aware CV creator and cover letter creator for managing statuses, follow-ups, job context, match insights, and tailored documents.",
  };

  return (
    <main id="main-content">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
      />
      <section className="hero section-pad">
        <div className="hero-orb hero-orb-one" aria-hidden="true" />
        <div className="hero-orb hero-orb-two" aria-hidden="true" />
        <div className="container hero-copy">
          <UnpluggedWordmark size="large" />
          <h1>
            Track every <br />
            <span>job application.</span>
          </h1>
          <p className="hero-lede">
            Careerden Unplugged is an open-source desktop job application tracker with profile-aware
            CV and cover-letter tools. Track opportunities, follow-ups, match insights, and
            documents in one place, all stored on your computer.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary button-large" href="/download">
              Download Careerden Unplugged <span aria-hidden="true">→</span>
            </Link>
            <a className="button button-outline button-large" href="#application-tracking">
              See the tracking workspace <span aria-hidden="true">→</span>
            </a>
          </div>
          <p className="hero-note">
            Tracking is the foundation. Automated capture and AI-assisted documents support it.
            <span aria-hidden="true"> · </span>
            <a href={githubUrl} rel="noreferrer" target="_blank">
              Explore Careerden on GitHub
            </a>
          </p>
        </div>
        <div className="container hero-preview">
          <ProductPreview />
        </div>
      </section>

      <section className="signal-strip" aria-label="Product principles">
        <div className="container signal-grid">
          <span>Job application tracker</span>
          <span>CV creator</span>
          <span>Cover letter creator</span>
          <span>Status &amp; follow-ups</span>
        </div>
      </section>

      <section className="section-pad tracking-section" id="application-tracking">
        <div className="container">
          <div className="tracking-heading">
            <div className="section-heading">
              <span className="kicker">Job application tracker</span>
              <h2>Keep the whole job search in view.</h2>
            </div>
            <p>
              Careerden is the place where each opportunity lives from discovery through follow-up.
              Matching and document generation help you prepare; the tracker helps you keep moving.
            </p>
          </div>

          <div className="tracking-grid">
            <article>
              <span className="tracking-icon">
                <LayoutDashboard aria-hidden="true" />
              </span>
              <small>Pipeline overview</small>
              <h3>See every application and stage</h3>
              <p>
                Review active applications, interview activity, match scores, recent changes, and
                the overall pipeline from one dashboard. Sort the full list by match, interest,
                salary, or date added.
              </p>
            </article>
            <article>
              <span className="tracking-icon">
                <ListChecks aria-hidden="true" />
              </span>
              <small>Application details</small>
              <h3>Keep the decision context together</h3>
              <p>
                Store status, job and company details, salary, work style, interest level, match
                evidence, and documents with the opportunity they belong to.
              </p>
            </article>
            <article>
              <span className="tracking-icon">
                <CalendarClock aria-hidden="true" />
              </span>
              <small>Next actions</small>
              <h3>Remember every follow-up</h3>
              <p>
                Schedule follow-ups and see them on the dashboard calendar, with contacts and notes
                kept close to the application, so the next conversation does not depend on memory or
                another spreadsheet.
              </p>
            </article>
            <article>
              <span className="tracking-icon">
                <Link2 aria-hidden="true" />
              </span>
              <small>Faster capture</small>
              <h3>Use LinkedIn capture as a shortcut</h3>
              <p>
                The desktop helper currently extracts LinkedIn job details to reduce data entry.
                LinkedIn is a capture source—not the purpose of the workspace.
              </p>
            </article>
          </div>

          <div className="tracking-source-note">
            <strong>Designed beyond a single job board</strong>
            <span>
              Use automated LinkedIn capture in the desktop app, or paste job and company details
              manually for other job boards, referrals, and company career pages.
            </span>
          </div>
        </div>
      </section>

      <section className="section-pad workflow-section latest-section" id="latest">
        <div className="container">
          <div className="section-heading centered">
            <span className="kicker">Latest in the workspace</span>
            <h2>Choose your CV layout. Sort what matters.</h2>
            <p>
              Recent updates make the profile you already maintain look the way you want and keep a
              growing list of applications easy to scan.
            </p>
          </div>
          <div className="workflow-story">
            <article className="workflow-step" id="base-resume">
              <div className="workflow-step-copy">
                <span className="kicker">Base resume</span>
                <h3>Pick from six CV layouts</h3>
                <p>
                  Preview your profile as an A4 page in Classic, Editorial, Modern, Minimal,
                  Technical, or Ledger, then set one as your default. Every tailored CV starts from
                  that layout, and you can still switch it for a single application.
                </p>
                <small className="workflow-step-note">
                  Without a filled-in profile, the layouts show sample content until you add your
                  own details.
                </small>
              </div>
              <div className="workflow-preview-wrap">
                <BaseResumeWorkflowPreview />
              </div>
            </article>

            <article className="workflow-step reverse" id="sorting">
              <div className="workflow-step-copy">
                <span className="kicker">Applications list</span>
                <h3>Sort by match, interest, salary, or date</h3>
                <p>
                  Select a column header to sort every application by it, select again to reverse
                  the order, and once more to return to the most recently updated first. Status
                  filters and search work alongside it.
                </p>
                <small className="workflow-step-note">
                  Applications without a value for the sorted column stay at the end of the list.
                </small>
              </div>
              <div className="workflow-preview-wrap">
                <ApplicationsSortingWorkflowPreview />
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="section-pad workflow-section" id="how-it-works">
        <div className="container">
          <div className="section-heading centered">
            <span className="kicker">How Careerden works</span>
            <h2>Set up once. Track and review every application.</h2>
            <p>
              Add your career details once, then create an application workspace for each role.
              Today, LinkedIn capture can fill the initial job details automatically.
            </p>
          </div>
          <div className="workflow-story">
            <article className="workflow-step" id="profile-setup">
              <div className="workflow-step-copy">
                <span className="workflow-number">01</span>
                <span className="kicker">Career profile</span>
                <h3>Add your profile</h3>
                <p>
                  Enter your summary, skills, experience, education, and projects. These details are
                  the source for every application.
                </p>
                <small className="workflow-step-note">
                  Keep the information factual. You can update each section later.
                </small>
              </div>
              <div className="workflow-preview-wrap">
                <ProfileWorkflowPreview />
              </div>
            </article>

            <article className="workflow-step reverse" id="first-job">
              <div className="workflow-step-copy">
                <span className="workflow-number">02</span>
                <span className="kicker">Application capture</span>
                <h3>Add your first application</h3>
                <p>
                  Import a LinkedIn URL in the desktop app or paste job and company details
                  manually. Careerden tracks the role, compares its requirements with your profile,
                  and opens the complete Overview shown below.
                </p>
                <small className="workflow-step-note">
                  LinkedIn remains the automated desktop capture source; manual copy-and-paste works
                  for applications from any source.
                </small>
              </div>
              <div className="workflow-preview-wrap">
                <JobProcessingWorkflowPreview />
              </div>
            </article>

            <article className="workflow-step" id="application-pack">
              <div className="workflow-step-copy">
                <span className="workflow-number">03</span>
                <span className="kicker">Application pack</span>
                <h3>Review the tailored CV</h3>
                <p>
                  See the match analysis, a live page preview of your tailored CV and cover letter,
                  and improvement tips linked to the job&apos;s requirements—side by side in the
                  same application.
                </p>
                <small className="workflow-step-note">
                  Keyword coverage shows which job terms your CV already uses; add only the ones you
                  can back up.
                </small>
              </div>
              <div className="workflow-preview-wrap">
                <ApplicationPackWorkflowPreview />
              </div>
            </article>

            <article className="workflow-step reverse" id="improvement-tips">
              <div className="workflow-step-copy">
                <span className="workflow-number">04</span>
                <span className="kicker">Improvement tips</span>
                <h3>Accept only what you can back up</h3>
                <p>
                  Each tip opens as a suggested change you can accept or discard. Accepted edits
                  appear in the CV preview immediately, and you can undo them or save them to your
                  profile for future applications.
                </p>
                <small className="workflow-step-note">
                  Then update the pack, download the PDFs, and keep status, contacts, notes, and
                  follow-ups with the same application.
                </small>
              </div>
              <div className="workflow-preview-wrap">
                <TailoringTipsWorkflowPreview />
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="section-pad unplugged-section" id="unplugged">
        <div className="container">
          <div className="tracking-heading">
            <div className="section-heading">
              <UnpluggedWordmark size="large" />
              <h2>Your job search, kept on your device.</h2>
            </div>
            <div className="unplugged-intro">
              <p>
                Careerden Unplugged is a separate desktop edition with the same tracking workspace.
                It sends no data to a Careerden server.
              </p>
              <Link className="button button-primary button-large" href="/download#unplugged">
                Download Careerden Unplugged <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>

          <div className="tracking-grid unplugged-grid">
            <article>
              <span className="tracking-icon">
                <HardDrive aria-hidden="true" />
              </span>
              <small>Local storage</small>
              <h3>Everything stays on your computer</h3>
              <p>
                Your profile, applications, follow-ups, and generated PDFs are stored in a database
                and files on your device.
              </p>
            </article>
            <article>
              <span className="tracking-icon">
                <KeyRound aria-hidden="true" />
              </span>
              <small>Bring your own AI</small>
              <h3>Use your own provider key</h3>
              <p>
                Connect OpenAI, Anthropic, Gemini, DeepSeek, or OpenRouter with your own API key.
                The key is stored with the operating system&apos;s secure storage.
              </p>
            </article>
            <article>
              <span className="tracking-icon">
                <WifiOff aria-hidden="true" />
              </span>
              <small>No account</small>
              <h3>No sign-up and no credits</h3>
              <p>
                Open the app and start tracking. AI analysis is billed by your provider instead of
                Careerden credits.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="section-pad pricing-section" id="pricing">
        <div className="container">
          <div className="section-heading centered">
            <span className="kicker">Simple pricing</span>
            <h2>Free on your computer. Cloud is coming soon.</h2>
            <p>
              Careerden Unplugged is free and open source, and its AI features run on your own
              provider key. A hosted cloud edition with accounts and AI credits is on the way.
            </p>
          </div>

          <div className="pricing-grid" aria-label="Pricing plans">
            <article className="pricing-card pricing-card-featured">
              <div className="pricing-card-heading">
                <div>
                  <UnpluggedWordmark />
                  <h3>
                    $0 <small>forever</small>
                  </h3>
                </div>
                <span className="pricing-plan-mark">Available now</span>
              </div>
              <p className="pricing-description">
                The complete workspace on your own computer, with AI billed by the provider you
                choose.
              </p>
              <ul>
                <li>
                  <Check aria-hidden="true" /> Complete application tracker
                </li>
                <li>
                  <Check aria-hidden="true" /> Profiles, CV layouts, documents, and follow-ups
                </li>
                <li>
                  <Check aria-hidden="true" /> Your own OpenAI, Anthropic, Gemini, DeepSeek, or
                  OpenRouter key
                </li>
                <li>
                  <Check aria-hidden="true" /> No account, no credits, data stays on your computer
                </li>
              </ul>
              <Link className="button button-primary button-large" href="/download">
                Download Careerden Unplugged
              </Link>
            </article>

            <article className="pricing-card pricing-card-soon">
              <div className="pricing-card-heading">
                <div>
                  <span className="pricing-plan-name">Careerden Cloud</span>
                  <h3 className="pricing-soon-title">Coming soon</h3>
                </div>
                <span className="pricing-plan-mark">In development</span>
              </div>
              <p className="pricing-description">
                Sign in from any computer to reach your applications, and use hosted AI credits
                instead of your own provider key.
              </p>
              <ul>
                <li>
                  <Check aria-hidden="true" /> Everything in the desktop workspace
                </li>
                <li>
                  <Check aria-hidden="true" /> Your applications and documents on every computer
                </li>
                <li>
                  <Check aria-hidden="true" /> 10 AI credits every UTC calendar month
                </li>
                <li>
                  <Check aria-hidden="true" /> Basic plan with 100 credits for $10 USD / month
                </li>
                <li>
                  <Check aria-hidden="true" /> One credit per completed match analysis
                </li>
              </ul>
              <span
                className="button button-outline button-large button-disabled"
                aria-disabled="true"
              >
                Coming soon
              </span>
            </article>
          </div>

          <p className="pricing-footnote">
            Cloud plans and credit terms may change before launch. Taxes may be added at checkout.
          </p>
        </div>
      </section>

      <section className="section-pad dark-section">
        <div className="container trust-grid">
          <div>
            <span className="kicker light">Open source on GitHub</span>
            <h2>Inspect the code and help shape Careerden.</h2>
            <a className="source-link" href={githubUrl} rel="noreferrer" target="_blank">
              <GitHubMark />
              View the Careerden repository
              <span aria-hidden="true">↗</span>
            </a>
          </div>
          <div className="trust-cards">
            <article>
              <span className="trust-icon">01</span>
              <h3>Built in the open</h3>
              <p>
                Explore the Careerden codebase, follow development, report issues, and contribute on
                GitHub under the GNU Affero General Public License v3.0.
              </p>
            </article>
            <article>
              <span className="trust-icon">02</span>
              <h3>Human review and privacy stay visible</h3>
              <p>
                AI drafts can be incomplete or wrong. Review every output and learn how profile,
                tracking, and document data are intended to be handled.
              </p>
              <Link href="/privacy">Read the Privacy Policy →</Link>
            </article>
          </div>
        </div>
      </section>

      <section className="section-pad" id="faq">
        <div className="container faq-layout">
          <div className="section-heading">
            <span className="kicker">Questions, answered</span>
            <h2>Know what happens before you begin</h2>
            <p>Careerden supports your application workflow; it does not replace your judgment.</p>
          </div>
          <div className="faq-list">
            {faqs.map(([question, answer], index) => (
              <details key={question} open={index === 0}>
                <summary>
                  {question}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-section section-pad">
        <div className="container cta-card">
          <div>
            <span className="kicker">Ready when you are</span>
            <h2>Bring your whole job search into focus.</h2>
            <p>
              Track each application first. Use capture, matching, and tailored documents when they
              help.
            </p>
          </div>
          <div className="cta-actions">
            <Link className="button button-light button-large" href="/download">
              Download Careerden Unplugged →
            </Link>
            <a className="button button-dark-outline" href="#faq">
              Read the FAQs
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
