import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUpDown,
  Archive,
  Award,
  Bell,
  Briefcase,
  Check,
  ChevronDown,
  CircleHelp,
  CreditCard,
  Download,
  EllipsisVertical,
  ExternalLink,
  FileText,
  FolderGit2,
  GraduationCap,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  LogOut,
  MapPin,
  MessageCircleQuestion,
  Minus,
  Pencil,
  Plus,
  Search,
  Settings,
  Settings2,
  Sparkles,
  SpellCheck,
  Undo2,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

type WorkspaceSection =
  "Dashboard" | "Applications" | "Profile" | "Base resume" | "Credits & billing" | "Settings";

const workspaceNavigation: { label: WorkspaceSection; Icon: LucideIcon }[] = [
  { label: "Dashboard", Icon: LayoutDashboard },
  { label: "Applications", Icon: ListChecks },
  { label: "Profile", Icon: UserRound },
  { label: "Base resume", Icon: FileText },
  { label: "Credits & billing", Icon: CreditCard },
  { label: "Settings", Icon: Settings },
];

function ApplicationPreviewFrame({
  active,
  children,
  className = "",
  label,
  subtitle,
  title,
}: {
  active: WorkspaceSection;
  children: ReactNode;
  className?: string;
  label: string;
  subtitle: string;
  title: string;
}) {
  return (
    <figure className="native-preview-figure">
      <section className={"native-preview " + className} aria-label={label} role="img">
        <div className="native-preview-shell">
          <aside className="native-preview-sidebar">
            <div className="native-window-controls" aria-hidden="true">
              <span className="close" />
              <span className="minimize" />
              <span className="maximize" />
            </div>
            <div className="native-preview-brand">
              <img alt="" src="/handshake-logo.svg" />
              <span>
                <strong>Careerden</strong>
                <small>Career workspace</small>
              </span>
            </div>
            <nav aria-label="Product preview navigation">
              <p>Workspace</p>
              {workspaceNavigation.map(({ label: itemLabel, Icon }) => (
                <span className={itemLabel === active ? "active" : ""} key={itemLabel}>
                  <Icon aria-hidden="true" />
                  {itemLabel}
                </span>
              ))}
            </nav>
            <div className="native-preview-sidebar-footer">
              <span>
                <CircleHelp aria-hidden="true" />
                Help &amp; support
              </span>
              <span>
                <LogOut aria-hidden="true" />
                Log out
              </span>
              <div className="native-preview-user">
                <b>AM</b>
                <span>
                  <strong>Alex Morgan</strong>
                  <small>alex@example.test</small>
                </span>
              </div>
            </div>
          </aside>
          <div className="native-preview-main">
            <header className="native-preview-topbar">
              <span>
                <strong>{title}</strong>
                <small>{subtitle}</small>
              </span>
              <div className="native-preview-tools" aria-hidden="true">
                <span className="native-credit-pill">
                  <Sparkles />8 credits
                </span>
                <span className="native-preview-search">
                  <Search />
                  Search applications…
                </span>
                <span className="native-icon-button">
                  <Bell />
                </span>
                <span className="native-primary-button">
                  <Plus />
                  Add job application
                </span>
              </div>
            </header>
            <div className="native-preview-content">{children}</div>
          </div>
        </div>
      </section>
      <figcaption className="native-preview-caption">Fictional presentation data</figcaption>
    </figure>
  );
}

const profileSections: { label: string; Icon: LucideIcon }[] = [
  { label: "Basic information", Icon: UserRound },
  { label: "Professional summary", Icon: FileText },
  { label: "Skills", Icon: Award },
  { label: "Experience", Icon: Briefcase },
  { label: "Education", Icon: GraduationCap },
  { label: "Projects & certifications", Icon: FolderGit2 },
];

export function ProfileWorkflowPreview() {
  return (
    <ApplicationPreviewFrame
      active="Profile"
      className="native-profile-preview"
      label="Fictional Careerden career profile workflow preview"
      subtitle="The foundation for every tailored document."
      title="Career profile"
    >
      <div className="native-profile-layout">
        <nav className="native-profile-nav" aria-label="Career profile preview sections">
          {profileSections.map(({ label, Icon }, index) => (
            <span className={index === 0 ? "active" : ""} key={label}>
              <Icon aria-hidden="true" />
              {label}
            </span>
          ))}
        </nav>
        <div className="native-profile-content">
          <section className="native-panel native-profile-identity">
            <span className="native-avatar">AM</span>
            <span>
              <strong>Alex Morgan</strong>
              <small>Product engineer · Rotterdam</small>
              <em>
                <Check aria-hidden="true" /> Profile saved
              </em>
            </span>
          </section>
          <section className="native-panel">
            <PanelHeader
              action={
                <span className="native-outline-button">
                  <Pencil aria-hidden="true" /> Edit
                </span>
              }
              description="Contact details and professional positioning"
              title="Basic information"
            />
            <div className="native-profile-fields">
              <ProfileField label="Full name" value="Alex Morgan" />
              <ProfileField label="Email" value="alex@example.test" />
              <ProfileField label="Profession" value="Product engineer" />
              <ProfileField label="Location" value="Rotterdam, Netherlands" />
            </div>
          </section>
          <section className="native-panel">
            <PanelHeader
              description="Used to ground tailored document content"
              title="Professional summary"
            />
            <p className="native-panel-copy">
              Product engineer focused on accessible React applications, dependable delivery, and
              clear collaboration across design and engineering.
            </p>
          </section>
          <div className="native-profile-evidence">
            <section className="native-panel">
              <PanelHeader description="Evidence available for matching" title="Skills" />
              <div className="native-skill-pills">
                <span>TypeScript</span>
                <span>React</span>
                <span>Accessibility</span>
                <span>Testing</span>
              </div>
            </section>
            <section className="native-panel">
              <PanelHeader description="Career evidence stays factual" title="Experience" />
              <div className="native-experience-row">
                <span>
                  <Briefcase aria-hidden="true" />
                </span>
                <span>
                  <strong>Senior Product Engineer</strong>
                  <small>Harbor Studio · 2022–Present</small>
                </span>
              </div>
            </section>
          </div>
        </div>
      </div>
    </ApplicationPreviewFrame>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}

function PanelHeader({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <header className="native-panel-header">
      <span>
        <strong>{title}</strong>
        {description && <small>{description}</small>}
      </span>
      {action}
    </header>
  );
}

export function JobProcessingWorkflowPreview() {
  return (
    <ApplicationPreviewFrame
      active="Applications"
      className="native-application-preview"
      label="Fictional Careerden application Overview workflow preview"
      subtitle="Review, generate, and track."
      title="Application"
    >
      <div className="native-application-page">
        <BackToApplications />
        <ApplicationHero />
        <ApplicationTabs active="overview" />
        <div className="native-overview-grid">
          <section className="native-panel native-role-summary">
            <PanelHeader title="Role summary" />
            <div>
              <h3>About the job</h3>
              <p>
                The product engineering team builds accessible tools used by people around the
                world. This role works across design and engineering to deliver dependable product
                experiences.
              </p>
              <h4>What you will do</h4>
              <ul>
                <li>Build and maintain TypeScript and React applications.</li>
                <li>Turn product requirements into accessible, tested interfaces.</li>
                <li>Collaborate with design, product, and platform teams.</li>
              </ul>
            </div>
          </section>
          <aside className="native-overview-aside">
            <AtAGlance />
            <section className="native-panel">
              <PanelHeader title="Job details" />
              <dl className="native-detail-list">
                <DetailRow label="Salary" value="Not set" editable />
                <DetailRow label="Work style" value="Remote" editable />
                <DetailRow label="Interest" value="High" editable />
              </dl>
            </section>
            <section className="native-panel">
              <PanelHeader title="Company details" />
              <div className="native-company-details">
                <div>
                  <span>Company website</span>
                  <strong>
                    careers.google.com <ExternalLink aria-hidden="true" />
                  </strong>
                </div>
                <p>
                  Company background captured from the job source appears here so the role can be
                  reviewed in context.
                </p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </ApplicationPreviewFrame>
  );
}

function BackToApplications() {
  return (
    <span className="native-back-link">
      <ArrowLeft aria-hidden="true" /> Back to applications
    </span>
  );
}

function ApplicationHero() {
  return (
    <section className="native-panel native-application-hero">
      <span className="native-company-logo">
        <img alt="" src="/company-logos/google.svg" />
      </span>
      <div className="native-application-details">
        <div className="native-role-line">
          <h2>Senior Full-Stack Product Engineer (Web Platform)</h2>
          <span className="native-status applied">
            <i /> Applied
          </span>
          <span className="native-status-select">
            Applied (current) <ChevronDown aria-hidden="true" />
          </span>
        </div>
        <p>Google</p>
        <div className="native-job-meta">
          <span>
            <MapPin aria-hidden="true" /> Amsterdam · 2 days ago
          </span>
          <span>
            <Briefcase aria-hidden="true" /> Full-time · Remote
          </span>
          <span className="match">
            <Sparkles aria-hidden="true" /> 59% match
          </span>
        </div>
      </div>
      <div className="native-application-actions">
        <span className="native-outline-button">
          <ExternalLink aria-hidden="true" /> View on LinkedIn
        </span>
        <span className="native-primary-button">
          <Sparkles aria-hidden="true" /> View application pack
        </span>
        <span className="native-icon-button" aria-label="Application actions">
          <EllipsisVertical aria-hidden="true" />
        </span>
      </div>
    </section>
  );
}

function ApplicationTabs({ active }: { active: "overview" | "pack" }) {
  return (
    <nav className="native-application-tabs" aria-label="Application preview tabs">
      <span className={active === "overview" ? "active" : ""}>Overview</span>
      <span className={active === "pack" ? "active" : ""}>Application pack</span>
      <span>Follow-ups &amp; notes</span>
    </nav>
  );
}

function AtAGlance() {
  return (
    <section className="native-panel">
      <PanelHeader title="At a glance" />
      <dl className="native-detail-list">
        <DetailRow label="Source" value="linkedin.com" />
        <DetailRow label="Added" value="Jul 18, 2026" />
        <DetailRow label="Status" value="Applied" />
        <DetailRow label="Match" value="59%" />
      </dl>
    </section>
  );
}

function DetailRow({
  editable = false,
  label,
  value,
}: {
  editable?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {value}
        {editable && <Pencil aria-hidden="true" />}
      </dd>
    </div>
  );
}

const packRequirements = [
  {
    className: "matched",
    label: "Matched",
    text: "Strong TypeScript and React product development",
  },
  { className: "partial", label: "Partially matched", text: "Building scalable frontend systems" },
  { className: "partial", label: "Partially matched", text: "Cross-functional product delivery" },
  { className: "missing", label: "Missing", text: "Google Cloud Platform" },
] as const;

export function ApplicationPackWorkflowPreview() {
  return (
    <ApplicationPreviewFrame
      active="Applications"
      className="native-pack-preview"
      label="Fictional Careerden application pack with live CV preview and improvement tips"
      subtitle="Review, generate, and track."
      title="Application"
    >
      <div className="native-pack-page">
        <BackToApplications />
        <ApplicationHero />
        <ApplicationTabs active="pack" />

        <section className="native-readiness-warning">
          <AlertTriangle aria-hidden="true" />
          <p>Your pack is ready to use, but adding skills may improve future tailoring.</p>
        </section>

        <section className="native-panel native-match-snapshot">
          <div className="native-match-score">
            <small>Role match</small>
            <strong>59%</strong>
            <p>Review before applying</p>
          </div>
          <div className="native-match-copy">
            <h3>Why this pack is tailored</h3>
            <p>
              Your profile shows strong React and TypeScript delivery. The draft emphasizes that
              evidence while clearly identifying the cloud-platform gap to review.
            </p>
            <div className="native-requirement-pills">
              {packRequirements.map((requirement) => (
                <span
                  aria-label={`${requirement.label}: ${requirement.text}`}
                  className={requirement.className}
                  key={requirement.text}
                >
                  {requirement.text}
                </span>
              ))}
            </div>
            <span className="native-evidence-link">▶ View match evidence</span>
          </div>
        </section>

        <div className="native-pack-grid">
          <div className="native-pack-main">
            <CvPreviewCard />
            <section className="native-panel native-pack-customizer">
              <header className="native-customizer-heading">
                <span className="native-customizer-icon">
                  <Settings2 aria-hidden="true" />
                </span>
                <span>
                  <strong>Customize this pack</strong>
                  <small>Edit your CV content directly, or apply a tip from the tips panel</small>
                </span>
                <em>
                  Show <ChevronDown aria-hidden="true" />
                </em>
              </header>
            </section>
            <section className="native-panel native-pack-actions">
              <span>
                <strong>Your application pack is up to date</strong>
                <small>Updates run in the background; you can leave this page safely.</small>
              </span>
              <span className="native-outline-button">
                <Download aria-hidden="true" /> Download both PDFs
              </span>
              <span className="native-primary-button">
                <Sparkles aria-hidden="true" /> Update pack
              </span>
            </section>
          </div>
          <TipsPanelPreview mode="overview" />
        </div>
      </div>
    </ApplicationPreviewFrame>
  );
}

export function TailoringTipsWorkflowPreview() {
  return (
    <ApplicationPreviewFrame
      active="Applications"
      className="native-pack-preview native-tips-preview"
      label="Fictional Careerden improvement tip review workflow preview"
      subtitle="Review, generate, and track."
      title="Application"
    >
      <div className="native-pack-page">
        <BackToApplications />
        <ApplicationTabs active="pack" />
        <div className="native-pack-grid">
          <div className="native-pack-main">
            <CvPreviewCard highlightSkill />
          </div>
          <TipsPanelPreview mode="review" />
        </div>
      </div>
    </ApplicationPreviewFrame>
  );
}

function CvPreviewCard({ highlightSkill = false }: { highlightSkill?: boolean }) {
  const skills = ["TypeScript", "React", "Accessibility", "Testing"];

  return (
    <section className="native-panel native-cv-card">
      <header className="native-cv-card-header">
        <span className="native-segmented">
          <b>Tailored CV</b>
          <span>Cover letter</span>
        </span>
        <em>Ready</em>
      </header>
      <div className="native-cv-toolbar">
        <small>1 page</small>
        <span className="native-zoom-control" aria-hidden="true">
          <Minus />
          <b>64%</b>
          <Plus />
        </span>
      </div>
      <div className="native-cv-scroll">
        <article className="native-cv-page">
          <header>
            <strong>Alex Morgan</strong>
            <span>Product Engineer</span>
            <small>alex@example.test • Rotterdam, Netherlands • github.com/alexmorgan</small>
          </header>
          <section>
            <h4>Summary</h4>
            <p>
              Product engineer focused on accessible React applications, dependable delivery, and
              clear collaboration across design and engineering.
            </p>
          </section>
          <section>
            <h4>Experience</h4>
            <h5>Senior Product Engineer · Harbor Studio</h5>
            <em>2022 – Present</em>
            <ul>
              <li>Built TypeScript and React tooling used by 40+ product teams.</li>
              <li>Led an accessibility program that brought core flows to WCAG 2.2 AA.</li>
            </ul>
            <h5>Frontend Engineer · Northwind Labs</h5>
            <em>2019 – 2022</em>
            <ul>
              <li>Shipped a component library and testing setup for three web products.</li>
            </ul>
          </section>
          <section>
            <h4>Skills</h4>
            <div className="native-cv-skills">
              {skills.map((skill) => (
                <span key={skill}>{skill}</span>
              ))}
              {highlightSkill && <span className="highlight">Design systems</span>}
            </div>
          </section>
        </article>
      </div>
      <footer className="native-cv-card-footer">
        <span className="native-outline-button">
          <Download aria-hidden="true" /> PDF
        </span>
      </footer>
    </section>
  );
}

function TipsPanelPreview({ mode }: { mode: "overview" | "review" }) {
  const isReview = mode === "review";

  return (
    <aside className="native-tips-panel" aria-label="Improvement tips preview">
      <header className="native-tips-heading">
        <span>
          <Lightbulb aria-hidden="true" />
        </span>
        <span>
          <strong>Improvement tips</strong>
          <small>Click a tip to preview the change before applying it</small>
        </span>
      </header>

      {isReview && (
        <div className="native-last-change">
          <span>
            Applied to <b>Skills</b>
          </span>
          <span>
            <Undo2 aria-hidden="true" /> Undo
          </span>
        </div>
      )}

      <section className="native-keyword-card">
        <div>
          <strong>Job keywords in your CV</strong>
          <small>{isReview ? "8 of 10" : "7 of 10"}</small>
        </div>
        <span className="native-keyword-bar">
          <i style={{ width: isReview ? "80%" : "70%" }} />
        </span>
        <small>Missing — add only the ones you can back up:</small>
        <p>
          <span>Google Cloud Platform</span>
          {!isReview && <span>Design systems</span>}
          <span>Mentoring</span>
        </p>
      </section>

      <div className="native-tip-group">
        <div className="native-tip-group-heading">
          <small>Summary</small>
          {!isReview && <span>Apply all (2)</span>}
        </div>
        <TipPreview
          highlighted={isReview}
          requirement="Cross-functional product delivery"
          text="Lead with the web platform work this team builds"
        />
        {isReview && <ProposalPreview />}
        {!isReview && (
          <TipPreview
            requirement="Building scalable frontend systems"
            text="Mention the scale of the React tooling you shipped"
          />
        )}
      </div>

      {!isReview && (
        <div className="native-tip-group">
          <div className="native-tip-group-heading">
            <small>Senior Product Engineer · Harbor Studio</small>
          </div>
          <TipPreview
            requirement="Strong TypeScript and React product development"
            text="Name the product outcome of the accessibility program"
          />
        </div>
      )}

      <div className="native-tip-group">
        <div className="native-tip-group-heading">
          <small>Skills</small>
        </div>
        <TipPreview applied={isReview} text="Add Design systems if you have used one" />
      </div>

      {isReview ? (
        <TipsSection Icon={SpellCheck} title="Writing checks">
          <span className="native-tip-card">
            <strong>Frontend Engineer · Northwind Labs</strong>
            <small>Add a result or number to show the impact.</small>
          </span>
        </TipsSection>
      ) : (
        <TipsSection Icon={MessageCircleQuestion} title="Fill the gaps">
          <small className="native-tips-note">
            Answer only what is true — your answer is the only new fact the AI may add.
          </small>
          <span className="native-tip-card">
            <span>Have you used Google Cloud Platform in production? Which services?</span>
            <small>Goes into Summary · For: Google Cloud Platform</small>
            <span className="native-gap-answer">Your answer, in your own words</span>
            <span className="native-xs-button disabled">Use answer</span>
          </span>
        </TipsSection>
      )}
    </aside>
  );
}

function TipsSection({
  children,
  Icon,
  title,
}: {
  children: ReactNode;
  Icon: LucideIcon;
  title: string;
}) {
  return (
    <section className="native-tips-section">
      <small className="native-tips-section-title">
        <Icon aria-hidden="true" />
        {title}
      </small>
      {children}
    </section>
  );
}

function TipPreview({
  applied = false,
  highlighted = false,
  requirement,
  text,
}: {
  applied?: boolean;
  highlighted?: boolean;
  requirement?: string;
  text: string;
}) {
  return (
    <span
      className={"native-tip" + (highlighted ? " highlighted" : "") + (applied ? " applied" : "")}
    >
      {applied ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
      <span>
        {text}
        {requirement && <small>For: {requirement}</small>}
      </span>
    </span>
  );
}

function ProposalPreview() {
  return (
    <div className="native-proposal" aria-label="Suggested change for Summary">
      <small>Suggested change</small>
      <p>
        Product engineer <del>focused on</del>
        <ins>building</ins> accessible React <del>applications</del>
        <ins>web platforms for product teams</ins>, dependable delivery, and clear collaboration
        across design and engineering.
      </p>
      <span className="native-proposal-checkbox">
        <i />
        Also save this to my profile, so future applications can use it
      </span>
      <span className="native-proposal-actions">
        <span className="native-xs-button ghost">
          <X aria-hidden="true" /> Discard
        </span>
        <span className="native-xs-button">
          <Check aria-hidden="true" /> Accept
        </span>
      </span>
    </div>
  );
}

const resumeTemplates = [
  { id: "classic", name: "Classic" },
  { id: "editorial", name: "Editorial", isDefault: true },
  { id: "modern", name: "Modern" },
  { id: "minimal", name: "Minimal" },
  { id: "technical", name: "Technical" },
  { id: "ledger", name: "Ledger" },
] as const;

export function BaseResumeWorkflowPreview() {
  return (
    <ApplicationPreviewFrame
      active="Base resume"
      className="native-base-resume-preview"
      label="Fictional Careerden base resume page with an A4 preview and six CV templates"
      subtitle="Pick the CV layout every tailored document starts from."
      title="Base resume"
    >
      <div className="native-base-resume-grid">
        <section className="native-panel native-base-resume-page">
          <header className="native-panel-header">
            <span>
              <strong>Editorial</strong>
              <small>A4 · 1 page</small>
            </span>
            <em className="native-default-pill">
              <Check aria-hidden="true" /> Default
            </em>
          </header>
          <div className="native-base-resume-canvas">
            <article className="native-editorial-page">
              <h4>Alex Morgan</h4>
              <p className="native-editorial-title">
                Product engineer building accessible web platforms
              </p>
              <small>alex@example.test · Rotterdam, Netherlands · github.com/alexmorgan</small>
              <h5>Profile</h5>
              <p>
                Product engineer focused on accessible React applications, dependable delivery, and
                clear collaboration across design and engineering.
              </p>
              <h5>Experience</h5>
              <div className="native-editorial-entry">
                <strong>Senior Product Engineer · Harbor Studio</strong>
                <em>2022 – Present</em>
              </div>
              <p>Built TypeScript and React tooling used by 40+ product teams.</p>
              <p>Led an accessibility program that brought core flows to WCAG 2.2 AA.</p>
              <div className="native-editorial-entry">
                <strong>Frontend Engineer · Northwind Labs</strong>
                <em>2019 – 2022</em>
              </div>
              <p>Shipped a component library and testing setup for three web products.</p>
              <h5>Education</h5>
              <div className="native-editorial-entry">
                <strong>BSc Computer Science · Delft University</strong>
                <em>2015 – 2019</em>
              </div>
            </article>
          </div>
        </section>

        <section className="native-panel native-template-panel">
          <header className="native-panel-header">
            <span>
              <strong>Templates</strong>
              <small>Tailored CVs start from your default layout.</small>
            </span>
          </header>
          <div className="native-template-grid">
            {resumeTemplates.map((template) => (
              <span
                className={"native-template-card" + (template.id === "editorial" ? " active" : "")}
                key={template.id}
              >
                <span className={"native-template-thumb " + template.id} aria-hidden="true">
                  <b />
                  <i />
                  <i />
                  <u />
                  <i />
                  <i />
                  <i />
                  <u />
                  <i />
                  <i />
                </span>
                <span className="native-template-name">
                  {template.name}
                  {"isDefault" in template && <small>In use</small>}
                </span>
              </span>
            ))}
          </div>
        </section>
      </div>
    </ApplicationPreviewFrame>
  );
}

const sortedApplications = [
  {
    initials: "HS",
    role: "Senior Product Engineer",
    company: "Harbor Studio",
    status: "Interviewing",
    statusClass: "interview",
    match: 84,
    interest: "🔥 Highly interested",
    interestClass: "high",
    salary: "€85,000 – €95,000 / year",
    added: "Jul 21",
  },
  {
    initials: "NL",
    role: "Frontend Engineer",
    company: "Northwind Labs",
    status: "Applied",
    statusClass: "applied",
    match: 76,
    interest: "🔥 Highly interested",
    interestClass: "high",
    salary: "€78,000 / year",
    added: "Jul 18",
  },
  {
    initials: "LC",
    role: "Design Systems Engineer",
    company: "Lumen Cloud",
    status: "Saved",
    statusClass: "saved",
    match: 72,
    interest: "👀 Interested",
    interestClass: "medium",
    salary: "€70,000 – €80,000 / year",
    added: "Jul 23",
  },
  {
    initials: "QB",
    role: "Web Platform Engineer",
    company: "Quill Books",
    status: "Saved",
    statusClass: "saved",
    match: 66,
    interest: "👀 Interested",
    interestClass: "medium",
    salary: "€72,000 / year",
    added: "Jul 15",
  },
  {
    initials: "AF",
    role: "Product Engineer",
    company: "Atlas Freight",
    status: "Applied",
    statusClass: "applied",
    match: 58,
    interest: "🤔 Low interest",
    interestClass: "low",
    salary: "—",
    added: "Jul 9",
  },
  {
    initials: "BR",
    role: "Frontend Developer",
    company: "Brightline Retail",
    status: "Saved",
    statusClass: "saved",
    match: 49,
    interest: "—",
    interestClass: "low",
    salary: "—",
    added: "Jul 6",
  },
] as const;

export function ApplicationsSortingWorkflowPreview() {
  const columns = [
    { label: "Match" },
    { label: "Interest", direction: "desc" },
    { label: "Salary" },
    { label: "Added", end: true },
  ];

  return (
    <ApplicationPreviewFrame
      active="Applications"
      className="native-applications-preview"
      label="Fictional Careerden applications list sorted by interest"
      subtitle="Every role you're tracking, in one organized place."
      title="Applications"
    >
      <div className="native-applications-toolbar">
        <span className="native-applications-search">
          <Search aria-hidden="true" />
          Search company or role...
        </span>
        <span className="native-outline-button">
          <Archive aria-hidden="true" /> Archived applications
        </span>
      </div>
      <div className="native-status-chips">
        {["All", "Processing", "Ready", "Saved", "Applied", "Interviewing", "Not selected"].map(
          (chip) => (
            <span className={chip === "All" ? "active" : ""} key={chip}>
              {chip}
            </span>
          ),
        )}
      </div>
      <section className="native-panel native-applications-table">
        <div className="native-applications-row native-applications-head">
          <span>Company &amp; role</span>
          <span>Status</span>
          {columns.map((column) => (
            <span
              className={(column.direction ? "sorted" : "") + (column.end ? " end" : "")}
              key={column.label}
            >
              {column.label}
              {column.direction ? (
                <ArrowDown aria-hidden="true" />
              ) : (
                <ArrowUpDown aria-hidden="true" />
              )}
            </span>
          ))}
        </div>
        {sortedApplications.map((application) => (
          <div className="native-applications-row" key={application.role}>
            <span className="native-applications-company">
              <b>{application.initials}</b>
              <span>
                <strong>{application.role}</strong>
                <small>{application.company}</small>
              </span>
            </span>
            <span>
              <em className={"native-status-pill " + application.statusClass}>
                {application.status}
              </em>
            </span>
            <span className="native-match-cell">
              <i>
                <i style={{ width: `${application.match}%` }} />
              </i>
              {application.match}%
            </span>
            <span className={"native-interest " + application.interestClass}>
              {application.interest}
            </span>
            <small>{application.salary}</small>
            <small className="end">{application.added}</small>
          </div>
        ))}
      </section>
    </ApplicationPreviewFrame>
  );
}
