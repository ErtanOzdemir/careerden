import { Link } from "react-router-dom";
import { mockDashboardStats } from "../mockData";

const maxWeekly = Math.max(...mockDashboardStats.weeklyTrend);

const kpiCards = [
  {
    key: "totalApplications",
    icon: "description",
    iconBg: "bg-primary-fixed",
    iconColor: "text-primary",
    trendColor: "text-tertiary-container",
  },
  {
    key: "activeInterviews",
    icon: "forum",
    iconBg: "bg-secondary-fixed",
    iconColor: "text-secondary",
    trendColor: "text-primary",
  },
  {
    key: "offers",
    icon: "workspace_premium",
    iconBg: "bg-tertiary-fixed",
    iconColor: "text-tertiary",
    trendColor: "text-tertiary",
  },
  {
    key: "rejectionRate",
    icon: "trending_down",
    iconBg: "bg-error-container",
    iconColor: "text-error",
    trendColor: "text-on-error-container",
  },
];

const monthLabels = ["Mar", "Apr", "May"];

const statusColors: Record<string, string> = {
  Applied: "bg-primary",
  Interviewing: "bg-secondary-fixed",
  Offer: "bg-tertiary",
  Rejected: "bg-error",
};

export default function Dashboard() {
  const stats = mockDashboardStats;

  return (
    <div className="animate-fade-in space-y-xl max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <h2 className="font-display text-display text-on-surface">
            Application Dashboard
          </h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-1">
            Tracking your journey to the next big role.
          </p>
        </div>
        <div className="flex gap-sm">
          <button className="px-lg py-sm rounded-lg border border-outline-variant text-secondary font-semibold hover:bg-surface-container transition-colors cursor-pointer">
            Download Report
          </button>
          <button className="px-lg py-sm rounded-lg bg-primary text-on-primary font-semibold shadow-sm hover:opacity-90 transition-opacity cursor-pointer">
            Quick Add
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-lg">
        {kpiCards.map((card) => {
          const kpi = stats.kpis[card.key as keyof typeof stats.kpis];
          const displayValue = card.key === "rejectionRate" ? `${kpi.value}%` : kpi.value;
          return (
            <div
              key={card.key}
              className="bg-white/70 backdrop-blur border border-outline-variant/80 p-lg rounded-xl shadow-sm flex flex-col justify-between"
            >
              <div className="flex justify-between items-start">
                <div className={`${card.iconBg} p-2 rounded-lg`}>
                  <span className={`material-symbols-outlined ${card.iconColor}`}>
                    {card.icon}
                  </span>
                </div>
                <span className={`text-xs font-bold ${card.trendColor}`}>
                  {kpi.label}
                </span>
              </div>
              <div className="mt-md">
                <p className="text-secondary font-label-md text-label-md uppercase tracking-tight">
                  {card.key === "totalApplications"
                    ? "Total Applications"
                    : card.key === "activeInterviews"
                      ? "Active Interviews"
                      : card.key === "offers"
                        ? "Offers Received"
                        : "Rejection Rate"}
                </p>
                <h3 className="font-headline-lg text-headline-lg text-on-surface mt-1">
                  {displayValue}
                </h3>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        <div className="lg:col-span-2 bg-white/70 backdrop-blur border border-outline-variant/80 p-lg rounded-xl shadow-sm">
          <div className="flex justify-between items-center mb-xl">
            <h4 className="font-headline-md text-headline-md text-on-surface">
              Applications Growth
            </h4>
            <div className="flex bg-surface-container rounded-lg p-1">
              <button className="px-3 py-1 text-xs font-bold bg-white rounded shadow-sm cursor-pointer">
                3 Months
              </button>
              <button className="px-3 py-1 text-xs text-secondary cursor-pointer">
                6 Months
              </button>
            </div>
          </div>
          <div className="h-64 relative overflow-hidden">
            <div className="absolute inset-0 flex items-end justify-between px-2">
              {stats.weeklyTrend.map((val, i) => {
                const pct = (val / maxWeekly) * 100;
                const isHighest = val === maxWeekly;
                return (
                  <div
                    key={i}
                    className={`w-[12%] rounded-t-sm ${
                      isHighest ? "bg-primary" : "bg-primary-fixed-dim"
                    }`}
                    style={{
                      height: `${pct}%`,
                      opacity: isHighest ? 1 : Math.max(0.2, pct / 100),
                    }}
                  />
                );
              })}
            </div>
            <svg
              className="absolute inset-0 w-full h-full text-primary opacity-40"
              preserveAspectRatio="none"
              viewBox="0 0 100 100"
            >
              <path
                d="M0,80 Q25,70 50,40 T100,10"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
            <div className="absolute bottom-0 w-full flex justify-between text-label-sm text-secondary pt-2 border-t border-outline-variant">
              {monthLabels.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur border border-outline-variant/80 p-lg rounded-xl shadow-sm flex flex-col">
          <h4 className="font-headline-md text-headline-md text-on-surface mb-xl">
            Status Distribution
          </h4>
          <div className="flex-1 flex flex-col items-center justify-center relative">
            <div className="w-40 h-40 rounded-full border-[16px] border-primary-fixed flex items-center justify-center relative">
              <div
                className="absolute inset-[-16px] rounded-full border-[16px] border-primary"
                style={{ clipPath: "polygon(50% 50%, 50% 0%, 100% 0%, 100% 50%)" }}
              />
              <div
                className="absolute inset-[-16px] rounded-full border-[16px] border-secondary-fixed"
                style={{ clipPath: "polygon(50% 50%, 100% 50%, 100% 100%, 50% 100%)" }}
              />
              <div className="text-center">
                <span className="font-display text-headline-lg block">
                  {stats.statusDistributionTotal}
                </span>
                <span className="text-label-sm text-secondary">Total</span>
              </div>
            </div>
            <div className="mt-xl w-full grid grid-cols-2 gap-sm">
              {stats.applicationsByStatus.map((item) => (
                <div key={item.status} className="flex items-center gap-2">
                  <span
                    className={`w-3 h-3 rounded-full ${statusColors[item.status] || "bg-outline"}`}
                  />
                  <span className="text-body-md text-secondary">
                    {item.status} ({item.count})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <section className="bg-white/70 backdrop-blur border border-outline-variant/80 rounded-xl shadow-sm flex flex-col">
        <div className="p-lg border-b border-outline-variant flex justify-between items-center">
          <h4 className="font-headline-md text-headline-md text-on-surface">
            Upcoming Interviews
          </h4>
          <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-label-sm">
            Next 7 Days
          </span>
        </div>
        <div className="divide-y divide-outline-variant">
          {stats.upcomingInterviews.map((interview, i) => (
            <div
              key={i}
              className="p-lg flex items-start gap-md hover:bg-surface-container-low transition-colors group"
            >
              <div className="bg-surface-container-high rounded-lg p-sm text-center min-w-[64px]">
                <span className="block text-label-sm text-secondary font-bold uppercase">
                  {interview.month}
                </span>
                <span className="block text-headline-md text-primary">
                  {interview.day}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex justify-between">
                  <h5 className="font-headline-md text-on-surface group-hover:text-primary transition-colors">
                    {interview.role}
                  </h5>
                  <span className="text-body-md text-secondary">
                    {interview.time}
                  </span>
                </div>
                <p className="text-body-md font-bold text-secondary-fixed-dim bg-secondary/10 inline-block px-2 rounded mt-1">
                  {interview.company}
                </p>
                <div className="mt-md flex items-center gap-lg">
                  <Link
                    to="/profile"
                    className="text-primary font-semibold text-body-md flex items-center gap-1 hover:underline"
                  >
                    <span className="material-symbols-outlined text-sm">link</span>
                    Prep Notes
                  </Link>
                  <span className="text-label-sm text-outline flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">
                      {interview.meetType}
                    </span>
                    {interview.meetLabel}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <Link
          to="/applications"
          className="p-md text-primary font-bold text-body-md hover:bg-surface-container-highest transition-colors text-center border-t border-outline-variant"
        >
          View All Interviews
        </Link>
      </section>
    </div>
  );
}
