import type { CreditRepository, EnsureCreditGrantResult } from "@careerden/domain";
import {
  freeMonthlyCreditAmount,
  getFreeMonthlyGrantIdempotencyKey,
  getUtcMonthlyCreditPeriod,
} from "@careerden/domain";

export async function ensureCurrentMonthlyCredits(
  credits: CreditRepository,
  userId: string,
  now: Date,
): Promise<EnsureCreditGrantResult> {
  const period = getUtcMonthlyCreditPeriod(now);

  return credits.ensureGrant({
    userId,
    sourceType: "free_monthly",
    idempotencyKey: getFreeMonthlyGrantIdempotencyKey(userId, period.key),
    amount: freeMonthlyCreditAmount,
    validFrom: period.startsAt,
    expiresAt: period.endsAt,
    metadata: { period: period.key },
    createdAt: now,
  });
}
