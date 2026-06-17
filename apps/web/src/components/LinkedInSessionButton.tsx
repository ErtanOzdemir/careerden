import { useEffect, useMemo, useState } from "react";
import { linkedInSessionApi } from "../api/linkedInSession";
import type { ApiLinkedInSessionStatusResult } from "../api/types";

const statusLabels: Record<ApiLinkedInSessionStatusResult["status"], string> = {
  connected: "LinkedIn connected",
  expired: "Reconnect LinkedIn",
  login_in_progress: "Save LinkedIn session",
  missing: "Connect LinkedIn",
};

export default function LinkedInSessionButton() {
  const [session, setSession] = useState<ApiLinkedInSessionStatusResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadStatus() {
      try {
        const status = await linkedInSessionApi.status();

        if (isMounted) {
          setSession(status);
          setError(null);
        }
      } catch (statusError) {
        if (isMounted) {
          setError(
            statusError instanceof Error ? statusError.message : "Could not load LinkedIn status.",
          );
        }
      }
    }

    void loadStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  const status = session?.status ?? "missing";
  const isConnected = status === "connected";
  const icon = useMemo(() => {
    if (isBusy) {
      return "progress_activity";
    }

    if (isConnected) {
      return "check_circle";
    }

    if (status === "login_in_progress") {
      return "save";
    }

    return "login";
  }, [isBusy, isConnected, status]);

  async function handleClick() {
    try {
      setIsBusy(true);
      setError(null);

      const next =
        status === "login_in_progress"
          ? await linkedInSessionApi.save()
          : await linkedInSessionApi.start();

      setSession(next);
    } catch (sessionError) {
      setError(
        sessionError instanceof Error ? sessionError.message : "LinkedIn session action failed.",
      );
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="relative group">
      <button
        onClick={handleClick}
        disabled={isBusy}
        className={`flex min-w-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-label-md font-bold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed sm:px-3 ${
          isConnected
            ? "bg-secondary-container text-on-secondary-container"
            : "bg-primary-container text-on-primary-container hover:bg-primary hover:text-on-primary"
        }`}
      >
        <span className={`material-symbols-outlined text-[18px] ${isBusy ? "animate-spin" : ""}`}>
          {icon}
        </span>
        <span className="hidden xl:inline">{isBusy ? "Working..." : statusLabels[status]}</span>
        <span className="hidden sm:inline xl:hidden">LinkedIn</span>
      </button>
      {(session?.message || error) && (
        <div className="absolute right-0 top-full mt-2 hidden group-hover:block w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-outline-variant bg-surface p-sm text-label-sm text-on-surface-variant shadow-lg z-50">
          {error ?? session?.message}
        </div>
      )}
    </div>
  );
}
