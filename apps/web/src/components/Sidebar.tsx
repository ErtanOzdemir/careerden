import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { requireDefaultProfileId } from "../api/config";
import { profileUpdatedEvent, profilesApi } from "../api/profiles";
import type { ApiProfile } from "../api/types";

const links = [
  { to: "/", icon: "dashboard", label: "Dashboard" },
  { to: "/applications", icon: "work", label: "Applications" },
  { to: "/profile", icon: "person", label: "Profile" },
];

export default function Sidebar() {
  const [profile, setProfile] = useState<ApiProfile | null>(null);

  useEffect(() => {
    let isMounted = true;

    profilesApi
      .get(requireDefaultProfileId())
      .then((loadedProfile) => {
        if (isMounted) {
          setProfile(loadedProfile);
        }
      })
      .catch(() => {
        if (isMounted) {
          setProfile(null);
        }
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

  const fullName = profile?.fullName.trim() || "Profile";
  const subtitle = profile?.profession?.trim() || profile?.email || "";

  return (
    <aside className="hidden lg:flex flex-col h-screen p-md bg-surface border-r border-outline-variant shadow-sm fixed left-0 top-0 w-64 z-50">
      <div className="mb-xl px-sm">
        <h1 className="font-display font-headline-lg text-headline-lg font-bold text-primary">
          Trackly
        </h1>
        <p className="font-display font-body-md text-body-md text-secondary">Job Tracker</p>
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
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-primary font-bold border border-outline-variant">
            {getInitials(fullName)}
          </div>
          <div className="overflow-hidden">
            <p className="text-label-md font-bold truncate">{fullName}</p>
            {subtitle && (
              <p className="text-label-sm text-secondary truncate text-[10px]">{subtitle}</p>
            )}
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
