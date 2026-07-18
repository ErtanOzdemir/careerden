import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Bell,
  Briefcase,
  Check,
  ChevronDown,
  CircleHelp,
  Download,
  ExternalLink,
  FileText,
  FolderGit2,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MapPin,
  Menu,
  Minus,
  MoreVertical,
  Pencil,
  PenLine,
  Plus,
  Printer,
  Redo2,
  RotateCw,
  Save,
  Scan,
  Search,
  Settings,
  Sparkles,
  Undo2,
  Upload,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

type WorkspaceSection = "Dashboard" | "Applications" | "Profile" | "Templates" | "Settings";

const workspaceNavigation: { label: WorkspaceSection; Icon: LucideIcon }[] = [
  { label: "Dashboard", Icon: LayoutDashboard },
  { label: "Applications", Icon: ListChecks },
  { label: "Profile", Icon: UserRound },
  { label: "Templates", Icon: FileText },
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
                <strong>Link2CV</strong>
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
                <span className="native-preview-search">
                  <Search />
                  Search applications…
                </span>
                <span className="native-icon-button">
                  <Bell />
                </span>
                <span className="native-primary-button">
                  <Plus />
                  Add LinkedIn job
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
      label="Fictional Link2CV career profile workflow preview"
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

export function TemplateUploadWorkflowPreview() {
  return (
    <ApplicationPreviewFrame
      active="Templates"
      className="native-template-preview"
      label="Fictional Link2CV document template upload workflow preview"
      subtitle="Manage your CV and cover letter templates."
      title="Document templates"
    >
      <TemplateWorkspace expandedCoverLetter={false} />
    </ApplicationPreviewFrame>
  );
}

export function VariableMappingWorkflowPreview() {
  return (
    <ApplicationPreviewFrame
      active="Templates"
      className="native-template-preview native-template-mapping-preview"
      label="Fictional Link2CV template variable mapping workflow preview"
      subtitle="Manage your CV and cover letter templates."
      title="Document templates"
    >
      <TemplateWorkspace expandedCoverLetter />
    </ApplicationPreviewFrame>
  );
}

function TemplateWorkspace({ expandedCoverLetter }: { expandedCoverLetter: boolean }) {
  return (
    <div className="native-template-page">
      <div className="native-upload-grid">
        <TemplateUploadPanel
          description="Upload a DOCX CV template and map its placeholders to your profile data."
          title="Upload CV template"
        />
        <TemplateUploadPanel
          description="Upload a DOCX cover-letter template, then map one placeholder to Content."
          title="Upload cover letter template"
        />
      </div>
      <div className="native-template-grid">
        <section className="native-panel native-template-group">
          <PanelHeader title="CV templates" />
          <div className="native-template-list">
            <TemplateRow fileName="alex-product-cv.docx" meta="DOCX · 6 variables · 7/18/2026" />
            <TemplateRow
              fileName="alex-engineering-cv.docx"
              meta="DOCX · 9 variables · 7/18/2026"
              status="Default"
            />
          </div>
        </section>
        <section className="native-panel native-template-group">
          <PanelHeader title="Cover letter templates" />
          <div className="native-template-list">
            <TemplateRow
              expanded={expandedCoverLetter}
              fileName="alex-cover-letter.docx"
              meta="DOCX · 1 variable · 7/18/2026"
              status={expandedCoverLetter ? "Default" : "Mapping required"}
            />
            {expandedCoverLetter && <CoverLetterMapping />}
          </div>
        </section>
      </div>
    </div>
  );
}

function TemplateUploadPanel({ description, title }: { description: string; title: string }) {
  return (
    <section className="native-panel native-upload-panel">
      <div>
        <span className="native-upload-icon">
          <Upload aria-hidden="true" />
        </span>
        <strong>{title}</strong>
        <p>{description}</p>
        <span className="native-outline-button">Browse DOCX</span>
      </div>
    </section>
  );
}

function TemplateRow({
  expanded = false,
  fileName,
  meta,
  status,
}: {
  expanded?: boolean;
  fileName: string;
  meta: string;
  status?: "Default" | "Mapping required";
}) {
  return (
    <div className="native-template-row">
      <span className="native-file-icon">
        <FileText aria-hidden="true" />
      </span>
      <span>
        <span className="native-template-name-line">
          <strong>{fileName}</strong>
          {status && (
            <em className={status === "Mapping required" ? "warning" : "success"}>
              {status === "Default" && <Check aria-hidden="true" />}
              {status}
            </em>
          )}
        </span>
        <small>{meta}</small>
      </span>
      <ChevronDown className={expanded ? "expanded" : ""} aria-hidden="true" />
    </div>
  );
}

function CoverLetterMapping() {
  return (
    <div className="native-inline-mapping">
      <p>
        Content supports rich formatting, so its DOCX placeholder must be the only text in its
        paragraph.
      </p>
      <div className="native-mapping-row">
        <span>Content</span>
        <strong>Reviewed cover-letter body</strong>
        <span className="native-mapping-select">
          {"{{content}}"} <ChevronDown aria-hidden="true" />
        </span>
      </div>
      <div className="native-mapping-save">
        <span />
        <span className="native-disabled-button">
          <Save aria-hidden="true" /> Save Mapping
        </span>
      </div>
      <div className="native-template-actions">
        <span className="native-disabled-outline-button">Default template</span>
        <span className="native-delete-button">Delete template</span>
      </div>
    </div>
  );
}

export function JobProcessingWorkflowPreview() {
  return (
    <ApplicationPreviewFrame
      active="Applications"
      className="native-application-preview"
      label="Fictional Link2CV application Overview workflow preview"
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
        </div>
        <span className="native-status-select">
          Applied (current) <ChevronDown aria-hidden="true" />
        </span>
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
    label: "Matched: TypeScript and React product development",
    text: "Strong TypeScript and React product development",
  },
  {
    className: "partial",
    label: "Partially matched: Building scalable frontend systems",
    text: "Experience building scalable frontend systems",
  },
  {
    className: "partial",
    label: "Partially matched: Cross-functional product delivery",
    text: "Cross-functional product delivery experience",
  },
  {
    className: "missing",
    label: "Missing: Google Cloud Platform",
    text: "Working knowledge of Google Cloud Platform",
  },
] as const;

export function ApplicationPackWorkflowPreview() {
  return (
    <ApplicationPreviewFrame
      active="Applications"
      className="native-pack-preview"
      label="Fictional Link2CV application pack and customization workflow preview"
      subtitle="Review, generate, and track."
      title="Application"
    >
      <div className="native-pack-page">
        <BackToApplications />
        <ApplicationHero />
        <ApplicationTabs active="pack" />

        <section className="native-panel native-pack-heading">
          <div>
            <span className="native-pack-icon">
              <Sparkles aria-hidden="true" />
            </span>
            <span>
              <strong>Application pack</strong>
              <small>One tailored CV and cover letter for this role.</small>
            </span>
          </div>
          <em>
            <Check aria-hidden="true" /> Ready
          </em>
          <ol>
            {["Job captured", "Content tailored", "Documents ready"].map((label) => (
              <li key={label}>
                <span>
                  <Check aria-hidden="true" />
                </span>
                {label}
              </li>
            ))}
          </ol>
        </section>

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
            <small>4 requirements supported</small>
            <div className="native-requirement-pills">
              {packRequirements.map((requirement) => (
                <span
                  aria-label={requirement.label}
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

        <div className="native-document-grid">
          <DocumentPreviewCard kind="cv" title="Tailored CV" />
          <DocumentPreviewCard kind="letter" title="Cover letter" />
        </div>

        <section className="native-panel native-pack-customizer">
          <header className="native-customizer-heading">
            <span className="native-customizer-icon">
              <Settings aria-hidden="true" />
            </span>
            <span>
              <strong>Customize this pack</strong>
              <small>Compare profile content, edit AI suggestions, and choose what appears</small>
            </span>
            <em>
              Hide <ChevronDown aria-hidden="true" />
            </em>
          </header>
          <div className="native-customizer-body">
            <div className="native-preference-grid">
              <PreferencePreview label="Language" value="English" />
              <PreferencePreview label="Tone" value="Professional" />
              <PreferencePreview label="CV template" value="alex-cv.docx" />
              <PreferencePreview label="Cover letter" value="alex-letter.docx" />
            </div>
            <div className="native-customizer-identity">
              <UserRound aria-hidden="true" />
              <span>
                <strong>Alex Morgan</strong>
                <small>alex@example.test · Rotterdam, Netherlands</small>
                <small>Identity and contact details stay linked to your profile.</small>
              </span>
              <span className="native-outline-button">Edit profile</span>
            </div>
            <section className="native-customization-section">
              <header>
                <span>
                  <FileText aria-hidden="true" /> Summary
                </span>
                <span>
                  AI source <ChevronDown aria-hidden="true" />
                </span>
              </header>
              <div className="native-customizer-toolbar">
                <small>Content source</small>
                <span>
                  <b>Use AI</b>
                  <i>Use profile</i>
                </span>
              </div>
              <div className="native-content-comparison">
                <section>
                  <small>Profile summary · Original</small>
                  <p>
                    Product engineer focused on accessible applications, reliable delivery, and
                    clear collaboration.
                  </p>
                </section>
                <section>
                  <small>AI-tailored summary · Editable</small>
                  <p>
                    Product engineer delivering accessible React platforms and dependable systems
                    for cross-functional teams.
                  </p>
                </section>
              </div>
            </section>
          </div>
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
    </ApplicationPreviewFrame>
  );
}

function PreferencePreview({ label, value }: { label: string; value: string }) {
  return (
    <span className="native-preference-field">
      <small>{label}</small>
      <b>
        {value} <ChevronDown aria-hidden="true" />
      </b>
    </span>
  );
}

function DocumentPreviewCard({ kind, title }: { kind: "cv" | "letter"; title: string }) {
  return (
    <section className="native-panel native-document-card">
      <header>
        <span className="native-file-icon">
          <FileText aria-hidden="true" />
        </span>
        <span>
          <strong>{title}</strong>
          <small>
            {kind === "cv"
              ? "Role-specific experience, summary, and skills"
              : "A concise introduction grounded in your profile"}
          </small>
        </span>
        <em>Ready</em>
      </header>
      <div className="native-document-body">
        <div className="native-document-toggle">
          <span>Live content</span>
          <b>Rendered PDF</b>
        </div>
        <StaticPdfViewer kind={kind} />
      </div>
      <footer>
        <span className="native-outline-button">
          <Download aria-hidden="true" /> PDF
        </span>
        <span className="native-outline-button">
          <Download aria-hidden="true" /> DOCX
        </span>
      </footer>
    </section>
  );
}

function StaticPdfViewer({ kind }: { kind: "cv" | "letter" }) {
  return (
    <div className="native-pdf-viewer">
      <div className="native-pdf-toolbar" aria-hidden="true">
        <Menu />
        <b>1</b>
        <span>/ 1</span>
        <i />
        <Minus />
        <Plus />
        <i />
        <Scan />
        <RotateCw />
        <i className="optional" />
        <PenLine className="optional" />
        <i className="optional" />
        <Undo2 className="muted optional" />
        <Redo2 className="muted optional" />
        <span className="spacer" />
        <Download />
        <Printer />
        <MoreVertical />
      </div>
      <div className="native-pdf-canvas">
        <div className={"native-pdf-page " + kind}>
          {kind === "cv" ? (
            <>
              <strong>ALEX MORGAN</strong>
              <small>PRODUCT ENGINEER</small>
              <span />
              <span />
              <span className="short" />
              <b>EXPERIENCE</b>
              <span />
              <span />
              <span className="medium" />
            </>
          ) : (
            <>
              <strong>Dear Hiring Team,</strong>
              <span />
              <span />
              <span className="medium" />
              <span />
              <span />
              <span className="short" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
