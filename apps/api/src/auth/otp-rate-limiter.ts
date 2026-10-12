import { createHash } from "node:crypto";

export type OtpRateLimitAction = "send" | "verify";

export interface OtpRateLimitRule {
  max: number;
  windowSeconds: number;
  minIntervalSeconds: number;
}

export interface OtpRateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface OtpRateLimiter {
  consume(email: string, action: OtpRateLimitAction): Promise<OtpRateLimitDecision>;
  reset(email: string, action: OtpRateLimitAction): Promise<void>;
}

export interface OtpRateLimitQueryable {
  query<Row extends Record<string, unknown>>(
    text: string,
    values: unknown[],
  ): Promise<{ rows: Row[] }>;
}

export const defaultOtpRateLimitRules: Record<OtpRateLimitAction, OtpRateLimitRule> = {
  send: { max: 5, windowSeconds: 60 * 60, minIntervalSeconds: 90 },
  verify: { max: 10, windowSeconds: 60 * 60, minIntervalSeconds: 0 },
};

const consumeSql = `
INSERT INTO auth_otp_rate_limit AS current (key, count, window_started_at, last_attempt_at)
VALUES ($1, 1, now(), now())
ON CONFLICT (key) DO UPDATE SET
  count = CASE
    WHEN current.window_started_at <= now() - make_interval(secs => $2) THEN 1
    ELSE current.count + 1
  END,
  window_started_at = CASE
    WHEN current.window_started_at <= now() - make_interval(secs => $2) THEN now()
    ELSE current.window_started_at
  END,
  last_attempt_at = now()
WHERE current.last_attempt_at <= now() - make_interval(secs => $4)
  AND (
    current.window_started_at <= now() - make_interval(secs => $2)
    OR current.count < $3
  )
RETURNING key`;

const retryAfterSql = `
SELECT GREATEST(
  CASE
    WHEN count >= $3
      THEN EXTRACT(EPOCH FROM window_started_at + make_interval(secs => $2) - now())
    ELSE 0
  END,
  EXTRACT(EPOCH FROM last_attempt_at + make_interval(secs => $4) - now()),
  1
) AS retry_after_seconds
FROM auth_otp_rate_limit
WHERE key = $1`;

/**
 * Per-email OTP counters stored in PostgreSQL so limits hold across API instances and restarts,
 * regardless of how many client IPs an attacker rotates through. Keys are hashed so raw email
 * addresses are never stored in the counter table.
 */
export class PostgresOtpRateLimiter implements OtpRateLimiter {
  constructor(
    private readonly database: OtpRateLimitQueryable,
    private readonly rules: Record<OtpRateLimitAction, OtpRateLimitRule> = defaultOtpRateLimitRules,
  ) {}

  async consume(email: string, action: OtpRateLimitAction): Promise<OtpRateLimitDecision> {
    const key = createOtpRateLimitKey(email, action);
    const rule = this.rules[action];
    const values = [key, rule.windowSeconds, rule.max, rule.minIntervalSeconds];

    const consumed = await this.database.query(consumeSql, values);
    if (consumed.rows.length > 0) {
      return { allowed: true, retryAfterSeconds: 0 };
    }

    const blocked = await this.database.query<{ retry_after_seconds: number | string }>(
      retryAfterSql,
      values,
    );
    const retryAfterSeconds = Math.ceil(Number(blocked.rows[0]?.retry_after_seconds ?? 1));
    return { allowed: false, retryAfterSeconds: Math.max(retryAfterSeconds, 1) };
  }

  async reset(email: string, action: OtpRateLimitAction): Promise<void> {
    await this.database.query("DELETE FROM auth_otp_rate_limit WHERE key = $1", [
      createOtpRateLimitKey(email, action),
    ]);
  }
}

export function createOtpRateLimitKey(email: string, action: OtpRateLimitAction): string {
  const emailHash = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  return `${action}:${emailHash}`;
}
