export const freeMonthlyCreditAmount = 10;
export const subscriptionMonthlyCreditAmount = 100;
export const matchAnalysisCreditCost = 1;
export const creditReservationDurationMs = 24 * 60 * 60 * 1000;

export interface UtcMonthlyCreditPeriod {
  key: string;
  startsAt: Date;
  endsAt: Date;
}

export function getUtcMonthlyCreditPeriod(at: Date): UtcMonthlyCreditPeriod {
  const year = at.getUTCFullYear();
  const month = at.getUTCMonth();
  const startsAt = new Date(Date.UTC(year, month, 1));
  const endsAt = new Date(Date.UTC(year, month + 1, 1));

  return {
    key: `${year}-${String(month + 1).padStart(2, "0")}`,
    startsAt,
    endsAt,
  };
}

export function getFreeMonthlyGrantIdempotencyKey(userId: string, periodKey: string): string {
  return `free:${userId}:${periodKey}`;
}
