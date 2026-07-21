import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, LayoutDashboard, Link2, ListChecks } from "lucide-react";
import { GitHubMark } from "@/components/GitHubMark";
import { ProductPreview } from "@/components/product-preview";
import {
  ApplicationPackWorkflowPreview,
  JobProcessingWorkflowPreview,
  ProfileWorkflowPreview,
  TemplateUploadWorkflowPreview,
  VariableMappingWorkflowPreview,
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
    "Open the desktop app and complete your career profile. Today, the desktop workflow can capture a LinkedIn posting automatically. You can also upload and map your own CV and cover-letter DOCX templates, or use the built-in layouts.",
  ],
  [
    "Is Careerden only for LinkedIn jobs?",
    "No. Careerden is a job-application tracking workspace. LinkedIn is the automated capture source currently supported by the desktop helper. Direct manual entry for applications from other sources is planned and is not available in the current release.",
  ],
  [
    "What can I track for each application?",
    "Keep the application status, job and company context, salary, work style, interest level, contacts, notes, follow-ups, match analysis, and generated documents together.",
  ],
  [
    "Can I control the output?",
    "Yes. Compare profile content with the AI-tailored draft, choose what to use, edit the CV or cover letter, and select Update pack to render the revised documents.",
  ],
  [
    "Is Careerden also a CV creator?",
    "Yes. The profile-aware CV creator and cover letter creator use your factual profile and each job's requirements to prepare editable drafts. You review and update every draft before use.",
  ],
  [
    "How is my data handled?",
    "The service needs profile, job, and generated-document data to provide its workflow. Read the Privacy Policy for the intended data model and the items still awaiting owner and legal confirmation.",
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
          <h1>
            Track every <br />
            <span>job application.</span>
          </h1>
          <p className="hero-lede">
            Careerden is an open-source desktop job application tracker with profile-aware CV and
            cover-letter tools. Track opportunities, follow-ups, match insights, and documents in
            one place.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary button-large" href="/download">
              Download desktop app <span aria-hidden="true">→</span>
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
                the overall pipeline from one dashboard.
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
                Schedule follow-ups and keep contacts and notes close to the application, so the
                next conversation does not depend on memory or another spreadsheet.
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
              Automated LinkedIn capture is available today. Direct manual application entry for
              other job boards, referrals, and company career pages is planned and is not available
              in the current release.
            </span>
          </div>
        </div>
      </section>

      <section className="section-pad workflow-section" id="how-it-works">
        <div className="container">
          <div className="section-heading centered">
            <span className="kicker">How Careerden works</span>
            <h2>Set up once. Track and review every application.</h2>
            <p>
              Add your career details and document templates once, then create an application
              workspace. Today, LinkedIn capture can fill the initial job details automatically.
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

            <article className="workflow-step reverse" id="template-setup">
              <div className="workflow-step-copy">
                <span className="workflow-number">02</span>
                <span className="kicker">Document templates</span>
                <h3>Upload your templates</h3>
                <p>
                  Add a DOCX file for your CV and another for your cover letter when you want to use
                  your own layouts.
                </p>
                <small className="workflow-step-note">
                  Built-in layouts remain available if you do not add custom templates.
                </small>
              </div>
              <div className="workflow-preview-wrap">
                <TemplateUploadWorkflowPreview />
              </div>
            </article>

            <article className="workflow-step" id="variable-mapping">
              <div className="workflow-step-copy">
                <span className="workflow-number">03</span>
                <span className="kicker">Variable mapping</span>
                <h3>Connect profile data to the DOCX</h3>
                <p>
                  Match each template placeholder to the profile field it should use, then save the
                  mapping.
                </p>
                <small className="workflow-step-note">
                  Cover-letter templates map one standalone placeholder to Content.
                </small>
              </div>
              <div className="workflow-preview-wrap">
                <VariableMappingWorkflowPreview />
              </div>
            </article>

            <article className="workflow-step reverse" id="first-job">
              <div className="workflow-step-copy">
                <span className="workflow-number">04</span>
                <span className="kicker">Application capture</span>
                <h3>Add your first application</h3>
                <p>
                  In the connected desktop app, paste a LinkedIn job URL. Careerden captures the
                  role as a tracked application, compares its requirements with your profile, and
                  opens the complete Overview shown below.
                </p>
                <small className="workflow-step-note">
                  LinkedIn is the current automated capture source. Direct manual application entry
                  is planned and is not available in the current release.
                </small>
              </div>
              <div className="workflow-preview-wrap">
                <JobProcessingWorkflowPreview />
              </div>
            </article>

            <article className="workflow-step" id="application-pack">
              <div className="workflow-step-copy">
                <span className="workflow-number">05</span>
                <span className="kicker">Application workspace</span>
                <h3>Review the pack and track progress</h3>
                <p>
                  Use the profile-aware CV creator and cover letter creator to review editable
                  drafts beside the match analysis. Update the pack when needed, then keep status,
                  contacts, notes, and follow-ups with the same application as it moves forward.
                </p>
                <small className="workflow-step-note">
                  The tracker remains useful even when you choose not to use AI-assisted content.
                </small>
              </div>
              <div className="workflow-preview-wrap">
                <ApplicationPackWorkflowPreview />
              </div>
            </article>
          </div>
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
                GitHub under the repository's current BSL 1.1 license.
              </p>
              <p>
                It is scheduled to convert to the open-source Apache License 2.0 under the license's
                stated terms.
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
              Download desktop app →
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
