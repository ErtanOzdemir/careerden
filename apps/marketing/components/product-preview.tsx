import {
  ArrowRight,
  Bell,
  CalendarDays,
  FileText,
  LayoutDashboard,
  Link2,
  ListChecks,
  Plus,
  Search,
  Settings,
  UserRound,
} from "lucide-react";

const navigation = [
  { label: "Dashboard", Icon: LayoutDashboard },
  { label: "Applications", Icon: ListChecks },
  { label: "Profile", Icon: UserRound },
  { label: "Templates", Icon: FileText },
  { label: "Settings", Icon: Settings },
];

const applications = [
  {
    logo: "/company-logos/google.svg",
    role: "Software Engineer",
    company: "Google",
    location: "Remote",
    match: "84% match",
    status: "Saved",
  },
  {
    logo: "/company-logos/microsoft.svg",
    role: "Product Engineer",
    company: "Microsoft",
    location: "Amsterdam",
    match: "76% match",
    status: "Applied",
  },
  {
    logo: "/company-logos/spotify.svg",
    role: "Frontend Engineer",
    company: "Spotify",
    location: "Stockholm",
    match: "72% match",
    status: "Saved",
  },
];

export function ProductPreview() {
  return (
    <div
      className="product-window"
      aria-label="Fictional Link2CV job application tracking dashboard preview"
      role="img"
    >
      <div className="window-bar">
        <span className="window-dot" />
        <span className="window-dot" />
        <span className="window-dot" />
        <span className="preview-label">Fictional data · Application tracking dashboard</span>
      </div>
      <div className="dashboard-preview-shell">
        <aside className="dashboard-preview-sidebar">
          <div className="dashboard-preview-brand">
            <img alt="" src="/handshake-logo.svg" />
            <div>
              <strong>Link2CV</strong>
              <span>Career workspace</span>
            </div>
          </div>
          <nav aria-label="Dashboard preview navigation">
            <p>Workspace</p>
            {navigation.map(({ label, Icon }, index) => (
              <span className={index === 0 ? "active" : ""} key={label}>
                <Icon aria-hidden="true" className="preview-icon" />
                {label}
              </span>
            ))}
          </nav>
          <div className="dashboard-preview-user">
            <span>AM</span>
            <div>
              <strong>Alex Morgan</strong>
              <small>alex@example.test</small>
            </div>
          </div>
        </aside>

        <div className="dashboard-preview-main">
          <div className="dashboard-preview-topbar">
            <div>
              <strong>Dashboard</strong>
              <span>Here&apos;s a calm overview of your job search.</span>
            </div>
            <div className="dashboard-preview-tools">
              <span>
                <Search aria-hidden="true" className="preview-icon" />
                Search applications…
              </span>
              <i aria-label="Notifications">
                <Bell aria-hidden="true" className="preview-icon" />
              </i>
              <b>
                <Plus aria-hidden="true" className="preview-icon" />
                Add LinkedIn job
              </b>
            </div>
          </div>

          <div className="dashboard-preview-body">
            <section className="dashboard-preview-callout">
              <span className="preview-link-icon">
                <Link2 aria-hidden="true" className="preview-icon" />
              </span>
              <div>
                <strong>Turn a LinkedIn posting into a tailored application</strong>
                <p>Paste a job URL and Link2CV handles extraction, analysis, and drafting.</p>
              </div>
              <b>
                <Plus aria-hidden="true" className="preview-icon" />
                Add LinkedIn job
              </b>
            </section>

            <div className="dashboard-preview-stats">
              {[
                ["Active applications", "4"],
                ["Interviewing", "1"],
                ["Ready to apply", "2"],
                ["Avg. match score", "80%"],
              ].map(([label, value]) => (
                <section key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </section>
              ))}
            </div>

            <div className="dashboard-preview-grid">
              <section className="dashboard-preview-panel applications-panel">
                <header>
                  <strong>Active applications</strong>
                  <span className="preview-inline-action">
                    View all <ArrowRight aria-hidden="true" className="preview-icon" />
                  </span>
                </header>
                {applications.map((application) => (
                  <div className="dashboard-preview-application" key={application.role}>
                    <span className="company-tile">
                      <img alt="" src={application.logo} />
                    </span>
                    <div>
                      <strong>{application.role}</strong>
                      <small>
                        {application.company} · {application.location}
                      </small>
                    </div>
                    <em>{application.match}</em>
                    <b>{application.status}</b>
                  </div>
                ))}
              </section>
              <section className="dashboard-preview-panel followups-panel">
                <header>
                  <strong>Upcoming follow-ups</strong>
                </header>
                <div className="dashboard-preview-followup">
                  <span>
                    <CalendarDays aria-hidden="true" className="preview-icon" />
                  </span>
                  <div>
                    <strong>Follow-up: Software Engineer</strong>
                    <small>Google</small>
                    <em>Tomorrow · Jul 24</em>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
