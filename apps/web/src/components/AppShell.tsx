import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useParams } from "react-router-dom";
import Sidebar from "./Sidebar.js";
import { Topbar } from "./Topbar.js";
import { AddJobDialog } from "./AddJobDialog.js";

const routeHeaders: Record<string, { title: string; subtitle?: string }> = {
  "/": {
    title: "Good morning",
    subtitle: "Here's a calm overview of your job search.",
  },
  "/applications": {
    title: "Applications",
    subtitle: "Every role you're tracking, in one organized place.",
  },
  "/profile": {
    title: "Career profile",
    subtitle: "The foundation for every tailored document.",
  },
  "/templates": {
    title: "Document templates",
    subtitle: "Manage your CV and cover letter templates.",
  },
  "/settings": {
    title: "Settings",
    subtitle: "Preferences, account, and app updates.",
  },
};

export default function AppShell() {
  const [addJobOpen, setAddJobOpen] = useState(false);
  const location = useLocation();
  const params = useParams();

  useEffect(() => {
    function handleOpenAddJob() {
      setAddJobOpen(true);
    }
    window.addEventListener("link2cv:open-add-job", handleOpenAddJob);
    return () => window.removeEventListener("link2cv:open-add-job", handleOpenAddJob);
  }, []);

  const header = useMemo(() => {
    if (routeHeaders[location.pathname]) {
      return routeHeaders[location.pathname];
    }
    if (location.pathname.startsWith("/applications/") && params.id) {
      return { title: "Application", subtitle: "Review, generate, and track." };
    }
    return { title: "Link2CV", subtitle: undefined };
  }, [location.pathname, params.id]);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
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
