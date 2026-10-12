import { useCallback, useEffect, useRef, useState } from "react";

/** Matches the API's minimum gap between verification codes sent to the same email. */
export const otpResendCooldownSeconds = 90;

const storageKey = "careerden.otp-resend-cooldowns";

export interface OtpResendCooldown {
  secondsRemaining: number;
  isCoolingDown: boolean;
  /** Starts a fresh cooldown after the server confirmed it sent (or refused to send) a code. */
  start(seconds?: number): void;
  /** Starts a cooldown only when none is running, for flows where the server may skip sending. */
  startIfIdle(): void;
}

/**
 * Tracks the resend cooldown for one OTP purpose and email. The deadline is remembered per email
 * so going back and forth between steps or reloading the page does not restart the countdown.
 */
export function useOtpResendCooldown(purpose: string, email: string): OtpResendCooldown {
  const scope = `${purpose}:${email.trim().toLowerCase()}`;
  const [availableAt, setAvailableAt] = useState<number | null>(() => readAvailableAt(scope));
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    setAvailableAt(readAvailableAt(scope));
  }, [scope]);

  const availableAtRef = useRef(availableAt);
  availableAtRef.current = availableAt;

  // One ticker for the component's lifetime; it only re-renders while a cooldown is running.
  useEffect(() => {
    const interval = window.setInterval(() => {
      const deadline = availableAtRef.current;
      if (deadline === null) return;

      const current = Date.now();
      setNow(current);
      if (current >= deadline) {
        setAvailableAt(null);
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const start = useCallback(
    (seconds = otpResendCooldownSeconds) => {
      const current = Date.now();
      const deadline = current + seconds * 1000;
      writeAvailableAt(scope, deadline);
      setNow(current);
      setAvailableAt(deadline);
    },
    [scope],
  );

  const startIfIdle = useCallback(() => {
    const existing = readAvailableAt(scope);
    if (existing === null) {
      start();
      return;
    }
    setNow(Date.now());
    setAvailableAt(existing);
  }, [scope, start]);

  const secondsRemaining =
    availableAt === null ? 0 : Math.max(0, Math.ceil((availableAt - now) / 1000));

  return { secondsRemaining, isCoolingDown: secondsRemaining > 0, start, startIfIdle };
}

export function formatOtpCooldown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Returns the server's retry delay for rate-limited auth requests, or null for other errors. */
export function getOtpRetryAfterSeconds(error: {
  status?: number;
  code?: string;
  retryAfterSeconds?: unknown;
}): number | null {
  if (error.status !== 429 && error.code !== "OTP_RATE_LIMITED") return null;
  const retryAfter = Number(error.retryAfterSeconds);
  return Number.isFinite(retryAfter) && retryAfter > 0
    ? Math.ceil(retryAfter)
    : otpResendCooldownSeconds;
}

function readAvailableAt(scope: string): number | null {
  const deadline = readCooldowns()[scope];
  return typeof deadline === "number" && deadline > Date.now() ? deadline : null;
}

function writeAvailableAt(scope: string, deadline: number): void {
  const now = Date.now();
  const active = Object.fromEntries(
    Object.entries(readCooldowns()).filter(([, value]) => value > now),
  );
  try {
    window.localStorage.setItem(storageKey, JSON.stringify({ ...active, [scope]: deadline }));
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the in-memory state still works.
  }
}

function readCooldowns(): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}");
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, number] => typeof entry[1] === "number",
      ),
    );
  } catch {
    return {};
  }
}
