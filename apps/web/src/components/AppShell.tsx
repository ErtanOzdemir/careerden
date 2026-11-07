import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useParams } from "react-router-dom";
import Sidebar from "./Sidebar.js";
import { Topbar } from "./Topbar.js";
import { AddJobDialog } from "./AddJobDialog.js";
import { DesktopNotificationBridge } from "./DesktopNotificationBridge.js";
import { readAddJobRequest, type ManualJobPrefill } from "./add-job-request.js";
import { openAddJobEventName } from "../onboarding/OnboardingGate.js";

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
  "/base-resume": {
    title: "Base resume",
    subtitle: "Pick the CV layout every tailored document starts from.",
  },
  "/billing": {
    title: "Credits & billing",
    subtitle: "AI credit usage, top-ups, and your Creem subscription.",
  },
  "/ai-provider": {
    title: "AI provider & API Keys",
    subtitle: "Your own API key for analysis and tailored documents.",
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
  const [manualPrefill, setManualPrefill] = useState<ManualJobPrefill>();
  const [greeting, setGreeting] = useState(() => getLocalGreeting());
  const location = useLocation();
  const params = useParams();

  useEffect(() => {
    const interval = window.setInterval(() => setGreeting(getLocalGreeting()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleOpenAddJob(event: Event) {
      setManualPrefill(readAddJobRequest(event).manual);
      setAddJobOpen(true);
    }
    window.addEventListener(openAddJobEventName, handleOpenAddJob);
    return () => window.removeEventListener(openAddJobEventName, handleOpenAddJob);
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
    <div className="app-shell flex h-screen overflow-hidden bg-background text-foreground">
      <DesktopNotificationBridge />
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col bg-background">
        <Topbar
          title={header.title}
          subtitle={header.subtitle}
          onAddJob={() => {
            setManualPrefill(undefined);
            setAddJobOpen(true);
          }}
        />

        <main className="scrollbar-soft flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-6 py-8">
            <Outlet />
          </div>
        </main>
      </div>

      <AddJobDialog
        open={addJobOpen}
        manualPrefill={manualPrefill}
        onClose={() => setAddJobOpen(false)}
      />
    </div>
  );
}

export function getLocalGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
