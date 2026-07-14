import { useEffect, useState } from "react";
import { Button } from "../components/ui/button.js";
import { Panel, PanelHeader } from "../components/link2cv/panel.js";
import { cn } from "../lib/utils.js";
import {
  ShieldCheck,
  RefreshCw,
  Clock,
  Lock,
  CircleCheck,
  TriangleAlert,
  LogIn,
} from "lucide-react";
import { LinkedinIcon } from "../components/link2cv/linkedin-icon.js";
import type { ApiLinkedInSessionStatusResult } from "../api/types.js";

type SessionState = ApiLinkedInSessionStatusResult["status"];

const stateConfig: Record<
  SessionState,
  {
    label: string;
    desc: string;
    tone: string;
    icon: typeof CircleCheck;
    cta: string;
  }
> = {
  connected: {
    label: "Connected",
    desc: "Your LinkedIn session is active and healthy.",
    tone: "success",
    icon: CircleCheck,
    cta: "Refresh session",
  },
  expired: {
    label: "Session expired",
    desc: "Your session has timed out. Reconnect.",
    tone: "warning",
    icon: Clock,
    cta: "Reconnect",
  },
  missing: {
    label: "Not connected",
    desc: "Connect LinkedIn to read job postings.",
    tone: "muted",
    icon: TriangleAlert,
    cta: "Connect LinkedIn",
  },
  login_in_progress: {
    label: "Login required",
    desc: "LinkedIn needs verification.",
    tone: "warning",
    icon: LogIn,
    cta: "Sign in to LinkedIn",
  },
};

const toneClasses: Record<string, { wrap: string; icon: string; dot: string }> = {
  success: {
    wrap: "border-success/20 bg-success-soft/50",
    icon: "bg-success-soft text-success",
    dot: "bg-success",
  },
  warning: {
    wrap: "border-warning/30 bg-warning-soft/50",
    icon: "bg-warning-soft text-warning-emphasis",
    dot: "bg-warning",
  },
  muted: {
    wrap: "border-border bg-muted/40",
    icon: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/50",
  },
};

export default function LinkedInSession() {
  const [session, setSession] = useState<ApiLinkedInSessionStatusResult | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    try {
      setError(null);
      if (window.electronAPI) {
        const s =
          (await window.electronAPI.getLinkedInSessionStatus()) as ApiLinkedInSessionStatusResult;
        setSession(s);
      } else {
        setSession({ status: "missing", message: "Available in the desktop app." });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
      setSession({ status: "missing" });
    }
  }

  async function handleAction() {
    if (!window.electronAPI) return;
    try {
      setIsBusy(true);
      setError(null);
      let result: ApiLinkedInSessionStatusResult;
      if (session?.status === "login_in_progress") {
        result = (await window.electronAPI.saveLinkedInSession()) as ApiLinkedInSessionStatusResult;
      } else {
        result =
          (await window.electronAPI.startLinkedInSession()) as ApiLinkedInSessionStatusResult;
      }
      setSession(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setIsBusy(false);
    }
  }

  const state: SessionState = session?.status ?? "missing";
  const config = stateConfig[state];
  const tone = toneClasses[config.tone];
  const Icon = config.icon;

  return (
    <div className="space-y-6">
      <Panel className={cn("border p-6", tone.wrap)}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "flex size-12 shrink-0 items-center justify-center rounded-xl",
                tone.icon,
              )}
            >
              <Icon className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", tone.dot)} />
                <p className="text-sm font-semibold text-foreground">{config.label}</p>
              </div>
              <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
                {config.desc}
              </p>
              {session?.message && (
                <p className="mt-1 text-xs text-muted-foreground">{session.message}</p>
              )}
            </div>
          </div>
          <Button
            className="shrink-0"
            variant={state === "connected" ? "outline" : "default"}
            onClick={handleAction}
            disabled={isBusy}
          >
            {isBusy && <RefreshCw className="size-4 animate-spin" />}
            {config.cta}
          </Button>
        </div>
      </Panel>

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-danger-soft p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader title="Connected account" />
          <div className="flex items-center gap-3.5 border-t border-border px-5 py-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-info-soft text-info">
              <LinkedinIcon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                {state === "connected" ? "LinkedIn account" : "Not connected"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {state === "connected" ? "Session active" : "Connect to enable scraping"}
              </p>
            </div>
            {session?.updatedAt && (
              <span className="text-xs text-muted-foreground">
                Last synced {new Date(session.updatedAt).toLocaleString()}
              </span>
            )}
          </div>
          <dl className="divide-y divide-border border-t border-border text-sm">
            {[
              ["Status", config.label],
              ["Session valid until", state === "connected" ? "Active" : "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between px-5 py-2.5">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel className="p-5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <ShieldCheck className="size-5" />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-foreground">Private & secure</h3>
          <ul className="mt-3 space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2.5">
              <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              Your session stays on your device — we never store your password.
            </li>
            <li className="flex gap-2.5">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              Used only to read the job postings you choose to add.
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
