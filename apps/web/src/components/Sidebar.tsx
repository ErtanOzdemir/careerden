import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "../lib/utils.js";
import {
  LayoutDashboard,
  ListChecks,
  UserRound,
  FileText,
  Settings,
  CircleHelp,
  Link2,
  LogOut,
} from "lucide-react";
import { LinkedinIcon } from "./link2cv/linkedin-icon.js";
import { profilesApi, profileUpdatedEvent } from "../api/profiles.js";
import { authClient } from "../api/auth.js";
import type { ApiProfile } from "../api/types.js";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/applications", label: "Applications", icon: ListChecks },
  { to: "/profile", label: "Profile", icon: UserRound },
  { to: "/templates", label: "Templates", icon: FileText },
  { to: "/linkedin", label: "LinkedIn session", icon: LinkedinIcon },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const [profile, setProfile] = useState<ApiProfile | null>(null);

  useEffect(() => {
    let isMounted = true;

    profilesApi
      .me()
      .then((p) => {
        if (isMounted) setProfile(p);
      })
      .catch(() => {
        if (isMounted) setProfile(null);
      });

    function handleProfileUpdated(event: Event) {
      setProfile((event as CustomEvent<ApiProfile>).detail);
    }

    window.addEventListener(profileUpdatedEvent, handleProfileUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener(profileUpdatedEvent, handleProfileUpdated);
    };
  }, []);

  const fullName = profile?.fullName?.trim() || "Profile";
  const email = profile?.email || "";
  const initials = getInitials(fullName);

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div data-testid="sidebar-brand" className="flex h-24 items-end gap-2.5 px-5 pb-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Link2 className="size-4" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-sidebar-foreground">Link2CV</p>
          <p className="text-xs text-muted-foreground">Career workspace</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        <p className="px-3 pb-1 text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
          Workspace
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )
              }
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="px-3 pb-4">
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground">
          <CircleHelp className="size-4 shrink-0" />
          Help & support
        </button>
        <button
          onClick={() => authClient.signOut()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        >
          <LogOut className="size-4 shrink-0" />
          Log out
        </button>
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-sidebar-border bg-card px-3 py-2.5">
          <div className="flex size-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
            {initials}
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-medium text-sidebar-foreground">{fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function getInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "P"
  );
}
