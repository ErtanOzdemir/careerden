import { NavLink } from "react-router-dom";

const links = [
  { to: "/", icon: "dashboard", label: "Dashboard" },
  { to: "/applications", icon: "work", label: "Applications" },
  { to: "/profile", icon: "person", label: "Profile" },
];

export default function Sidebar() {
  return (
    <aside className="hidden lg:flex flex-col h-screen p-md bg-surface border-r border-outline-variant shadow-sm fixed left-0 top-0 w-64 z-50">
      <div className="mb-xl px-sm">
        <h1 className="font-display font-headline-lg text-headline-lg font-bold text-primary">
          Trackly
        </h1>
        <p className="font-display font-body-md text-body-md text-secondary">
          Job Tracker
        </p>
      </div>
      <nav className="flex-1 space-y-2">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg font-body-md transition-colors ${
                isActive
                  ? "bg-secondary-container text-on-secondary-container font-semibold"
                  : "text-secondary hover:bg-surface-container-highest"
              }`
            }
          >
            <span className="material-symbols-outlined">{link.icon}</span>
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto pt-lg border-t border-outline-variant">
        <button className="w-full flex items-center justify-center gap-2 bg-primary-container text-on-primary text-body-md font-semibold py-3 px-4 rounded-lg shadow-sm hover:opacity-90 transition-opacity cursor-pointer">
          <span className="material-symbols-outlined">add_circle</span>
          Add Application
        </button>
        <div className="mt-md flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-primary font-bold border border-outline-variant">
            AC
          </div>
          <div className="overflow-hidden">
            <p className="text-label-md font-bold truncate">Alex Chen</p>
            <p className="text-label-sm text-secondary truncate text-[10px]">
              Premium Account
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
