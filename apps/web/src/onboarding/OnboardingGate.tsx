import { useEffect, useState } from "react";
import { profileUpdatedEvent, profilesApi } from "../api/profiles.js";
import type { ApiProfile } from "../api/types.js";
import { OnboardingWizard, type OnboardingFinish } from "./OnboardingWizard.js";

export const openAddJobEventName = "careerden:open-add-job";

/**
 * Shows the first-run setup wizard instead of the app shell until the profile records that
 * onboarding was finished or skipped. A failed profile read fails open so the app stays usable.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<ApiProfile | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [openAddJob, setOpenAddJob] = useState(false);

  useEffect(() => {
    let active = true;

    profilesApi.me().then(
      (loaded) => {
        if (!active) return;
        setProfile(loaded);
        setState("ready");
      },
      () => active && setState("unavailable"),
    );

    function handleProfileUpdated(event: Event) {
      const updated = (event as CustomEvent<ApiProfile>).detail;
      if (updated) setProfile(updated);
    }

    window.addEventListener(profileUpdatedEvent, handleProfileUpdated);
    return () => {
      active = false;
      window.removeEventListener(profileUpdatedEvent, handleProfileUpdated);
    };
  }, []);

  const showWizard = state === "ready" && profile !== null && !profile.onboardingCompletedAt;

  // Runs after the app shell has mounted and registered its add-job listener.
  useEffect(() => {
    if (showWizard || !openAddJob) return;
    setOpenAddJob(false);
    window.dispatchEvent(new CustomEvent(openAddJobEventName));
  }, [openAddJob, showWizard]);

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (showWizard) {
    return (
      <OnboardingWizard
        profile={profile}
        onProfileChange={setProfile}
        onFinish={(finish: OnboardingFinish) => setOpenAddJob(finish.openAddJob)}
      />
    );
  }

  return <>{children}</>;
}
