import {
  ArrowRight,
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  LayoutDashboard,
  Link2,
  ListChecks,
  Plus,
  Search,
  Settings,
  Sparkles,
  UserRound,
} from "lucide-react";

const navigation = [
  { label: "Dashboard", Icon: LayoutDashboard },
  { label: "Applications", Icon: ListChecks },
  { label: "Profile", Icon: UserRound },
  { label: "Base resume", Icon: FileText },
  { label: "Credits & billing", Icon: CreditCard },
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
  {
    logo: "/company-logos/northwind.svg",
    role: "Senior Frontend Engineer",
    company: "Northwind Labs",
    location: "Berlin",
    match: "88% match",
    status: "Interviewing",
  },
];

// July 2026 runs Wednesday to Friday, so its full weeks span Monday June 29 to Sunday August 2.
const calendarDays = [
  { day: 29, outside: true },
  { day: 30, outside: true },
  ...Array.from({ length: 31 }, (_, index) => ({ day: index + 1, outside: false })),
  { day: 1, outside: true },
  { day: 2, outside: true },
];
const followUpDays = new Set([21, 24, 28]);

// The dashboard's application pipeline: every application flowing into its current stage.
// Each ribbon carries the logos of the companies in that stage, like the app.
const pipelineStages = [
  {
    label: "Saved",
    count: 3,
    color: "#a3a3a3",
    companies: [{ logo: "/company-logos/google.svg" }, { logo: "/company-logos/spotify.svg" }],
  },
  {
    label: "Applied",
    count: 2,
    color: "#2f6db0",
    companies: [{ logo: "/company-logos/microsoft.svg" }, { initials: "QB" }],
  },
  {
    label: "Interviewing",
    count: 2,
    color: "#d98a0b",
    companies: [{ logo: "/company-logos/northwind.svg" }],
  },
  { label: "Offer", count: 1, color: "#1f9254", companies: [{ initials: "HS" }] },
];
const pipelineLogoRadius = 9;
const pipelineUnit = 15;
const pipelineGap = 9;
const pipelineTotal = pipelineStages.reduce((sum, stage) => sum + stage.count, 0);
const pipelineHeight = pipelineTotal * pipelineUnit + (pipelineStages.length - 1) * pipelineGap;
const pipelineSourceTop = 14 + (pipelineHeight - pipelineTotal * pipelineUnit) / 2;
const pipelineLinks = pipelineStages.map((stage, index) => {
  const before = pipelineStages.slice(0, index).reduce((sum, item) => sum + item.count, 0);
  const sourceY = pipelineSourceTop + before * pipelineUnit;
  const targetY = 14 + before * pipelineUnit + index * pipelineGap;
  return { ...stage, sourceY, targetY, height: stage.count * pipelineUnit };
});

function pipelineBand(sourceY: number, targetY: number, height: number) {
  const [left, right, middle] = [26, 780, 403];
  return [
    `M${left},${sourceY}`,
    `C${middle},${sourceY} ${middle},${targetY} ${right},${targetY}`,
    `L${right},${targetY + height}`,
    `C${middle},${targetY + height} ${middle},${sourceY + height} ${left},${sourceY + height}`,
    "Z",
  ].join(" ");
}
const selectedDay = 24;

export function ProductPreview() {
  return (
    <div
      className="product-window"
      aria-label="Fictional Careerden job application tracking dashboard preview"
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
              <strong>Careerden</strong>
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
              <span className="dashboard-preview-credits">
                <Sparkles aria-hidden="true" className="preview-icon" />8 credits
              </span>
              <span>
                <Search aria-hidden="true" className="preview-icon" />
                Search applications…
              </span>
              <i aria-label="Notifications">
                <Bell aria-hidden="true" className="preview-icon" />
              </i>
              <b>
                <Plus aria-hidden="true" className="preview-icon" />
                Add job application
              </b>
            </div>
          </div>

          <div className="dashboard-preview-body">
            <section className="dashboard-preview-callout">
              <span className="preview-link-icon">
                <Link2 aria-hidden="true" className="preview-icon" />
              </span>
              <div>
                <strong>Turn any job posting into a tailored application</strong>
                <p>Import from LinkedIn Desktop or paste the role details manually.</p>
              </div>
              <b>
                <Plus aria-hidden="true" className="preview-icon" />
                Add job application
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
                  <strong>Follow-ups</strong>
                </header>
                <div className="dashboard-preview-calendar">
                  <div className="dashboard-preview-calendar-month">
                    <ChevronLeft aria-hidden="true" className="preview-icon" />
                    <span>July 2026</span>
                    <ChevronRight aria-hidden="true" className="preview-icon" />
                  </div>
                  <div className="dashboard-preview-calendar-grid">
                    {["M", "T", "W", "T", "F", "S", "S"].map((weekday, index) => (
                      <small key={index}>{weekday}</small>
                    ))}
                    {calendarDays.map(({ day, outside }, index) => (
                      <span
                        className={
                          outside
                            ? "outside"
                            : day === selectedDay
                              ? "selected"
                              : day === 23
                                ? "today"
                                : undefined
                        }
                        key={index}
                      >
                        {day}
                        {!outside && followUpDays.has(day) && <i aria-hidden="true" />}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="dashboard-preview-calendar-day">Friday, July 24</p>
                <div className="dashboard-preview-followup">
                  <span>
                    <CalendarDays aria-hidden="true" className="preview-icon" />
                  </span>
                  <div>
                    <strong>Follow up with the recruiter</strong>
                    <small>Google</small>
                    <em>10:30 AM</em>
                  </div>
                </div>
              </section>
            </div>

            <section className="dashboard-preview-panel dashboard-preview-pipeline">
              <header>
                <strong>Application pipeline</strong>
              </header>
              <svg aria-hidden="true" viewBox={`0 0 900 ${pipelineHeight + 28}`}>
                <text x="16" y="9">
                  All applications<tspan> · {pipelineTotal}</tspan>
                </text>
                {pipelineLinks.map((link) => (
                  <path
                    d={pipelineBand(link.sourceY, link.targetY, link.height)}
                    fill={link.color}
                    fillOpacity={0.22}
                    key={link.label}
                  />
                ))}
                <rect
                  fill="#171717"
                  height={pipelineTotal * pipelineUnit}
                  rx="2"
                  width="8"
                  x="18"
                  y={pipelineSourceTop}
                />
                {pipelineLinks.map((link) => {
                  const centerY = (link.sourceY + link.targetY + link.height) / 2;
                  return link.companies.map((company, index) => {
                    const centerX =
                      403 + (index - (link.companies.length - 1) / 2) * (pipelineLogoRadius * 2.3);
                    return (
                      <g key={`${link.label}-${index}`}>
                        <circle
                          cx={centerX}
                          cy={centerY}
                          fill="#fff"
                          r={pipelineLogoRadius}
                          stroke="#e2e2e2"
                        />
                        {"logo" in company ? (
                          <image
                            height={pipelineLogoRadius * 1.15}
                            href={company.logo}
                            width={pipelineLogoRadius * 1.15}
                            x={centerX - pipelineLogoRadius * 0.575}
                            y={centerY - pipelineLogoRadius * 0.575}
                          />
                        ) : (
                          <text
                            className="dashboard-preview-pipeline-initials"
                            textAnchor="middle"
                            x={centerX}
                            y={centerY + 2.2}
                          >
                            {company.initials}
                          </text>
                        )}
                      </g>
                    );
                  });
                })}
                {pipelineLinks.map((link) => (
                  <g key={link.label}>
                    <rect
                      fill={link.color}
                      height={link.height}
                      rx="2"
                      width="8"
                      x="780"
                      y={link.targetY}
                    />
                    <text x="796" y={link.targetY + link.height / 2 + 2.5}>
                      {link.label}
                      <tspan> · {link.count}</tspan>
                    </text>
                  </g>
                ))}
              </svg>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
