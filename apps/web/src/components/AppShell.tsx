import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useParams } from "react-router-dom";
import Sidebar from "./Sidebar.js";
import { Topbar } from "./Topbar.js";
import { AddJobDialog } from "./AddJobDialog.js";
import { DesktopNotificationBridge } from "./DesktopNotificationBridge.js";

const routeHeaders: Record<string, { title: string; subtitle?: string }> = {
  "/": {
    title: "Dashboard",
    subtitle: "Here's a calm overview of your job search.",
  },
  "/applications": {
    title: "Applications",
    subtitle: "Every role you're tracking, in one organized place.",
  },
  "/applications/archived": {
    title: "Archived applications",
    subtitle: "Review, restore, or permanently delete archived roles.",
  },
  "/profile": {
    title: "Career profile",
    subtitle: "The foundation for every tailored document.",
  },
  "/settings": {
    title: "Settings",
    subtitle: "Preferences, account, and app updates.",
  },
  "/support": {
    title: "Help & support",
    subtitle: "Tell us how we can help.",
  },
};

export default function AppShell() {
  const [addJobOpen, setAddJobOpen] = useState(false);
  const [greeting, setGreeting] = useState(() => getLocalGreeting());
  const location = useLocation();
  const params = useParams();

  useEffect(() => {
    const interval = window.setInterval(() => setGreeting(getLocalGreeting()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleOpenAddJob() {
      setAddJobOpen(true);
    }
    window.addEventListener("careerden:open-add-job", handleOpenAddJob);
    return () => window.removeEventListener("careerden:open-add-job", handleOpenAddJob);
  }, []);

  const header = useMemo(() => {
    if (location.pathname === "/") {
      return { ...routeHeaders["/"], title: greeting };
    }
    if (routeHeaders[location.pathname]) {
      return routeHeaders[location.pathname];
    }
    if (location.pathname.startsWith("/applications/") && params.id) {
      return { title: "Application", subtitle: "Review, generate, and track." };
    }
    return { title: "Careerden", subtitle: undefined };
  }, [greeting, location.pathname, params.id]);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <DesktopNotificationBridge />
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          title={header.title}
          subtitle={header.subtitle}
          onAddJob={() => setAddJobOpen(true)}
        />

        <main className="scrollbar-soft flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-6 py-8">
            <Outlet />
          </div>
        </main>
      </div>

      <AddJobDialog open={addJobOpen} onClose={() => setAddJobOpen(false)} />
    </div>
  );
}

export function getLocalGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
