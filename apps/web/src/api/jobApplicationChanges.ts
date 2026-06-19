import { useEffect, useRef } from "react";
import { buildUrl } from "./client";

export interface JobApplicationChange {
  type: "application.changed" | "application.deleted";
  applicationId: string;
  profileId: string;
  occurredAt: string;
}

interface JobApplicationChangeHandlers {
  onChange: (change: JobApplicationChange) => void | Promise<void>;
  onOpen?: () => void | Promise<void>;
}

export function useJobApplicationChanges(
  profileId: string | undefined,
  handlers: JobApplicationChangeHandlers,
): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!profileId) {
      return;
    }

    const source = new EventSource(
      buildUrl("/job-applications/stream", {
        profileId,
      }),
    );
    const pending = new Map<string, number>();

    const handleEvent = (event: Event) => {
      const change = parseChange(event);

      if (!change) {
        return;
      }

      const existing = pending.get(change.applicationId);

      if (existing !== undefined) {
        window.clearTimeout(existing);
      }

      pending.set(
        change.applicationId,
        window.setTimeout(() => {
          pending.delete(change.applicationId);
          void handlersRef.current.onChange(change);
        }, 150),
      );
    };

    source.addEventListener("application.changed", handleEvent);
    source.addEventListener("application.deleted", handleEvent);
    source.onopen = () => {
      void handlersRef.current.onOpen?.();
    };

    return () => {
      for (const timeout of pending.values()) {
        window.clearTimeout(timeout);
      }

      source.close();
    };
  }, [profileId]);
}

function parseChange(event: Event): JobApplicationChange | null {
  if (!(event instanceof MessageEvent) || typeof event.data !== "string") {
    return null;
  }

  try {
    const change = JSON.parse(event.data) as Partial<JobApplicationChange>;

    if (
      (change.type === "application.changed" || change.type === "application.deleted") &&
      typeof change.applicationId === "string" &&
      typeof change.profileId === "string" &&
      typeof change.occurredAt === "string"
    ) {
      return change as JobApplicationChange;
    }
  } catch {
    return null;
  }

  return null;
}
