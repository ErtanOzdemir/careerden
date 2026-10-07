import { describe, expect, it } from "vitest";
import { getFreeMonthlyGrantIdempotencyKey, getUtcMonthlyCreditPeriod } from "./credit-policy.js";

describe("UTC monthly credit policy", () => {
  it("uses exact UTC calendar-month boundaries", () => {
    expect(getUtcMonthlyCreditPeriod(new Date("2026-07-31T23:59:59.999Z"))).toEqual({
      key: "2026-07",
      startsAt: new Date("2026-07-01T00:00:00.000Z"),
      endsAt: new Date("2026-08-01T00:00:00.000Z"),
    });
  });

  it("rolls December into the following UTC year", () => {
    expect(getUtcMonthlyCreditPeriod(new Date("2026-12-12T12:00:00.000Z"))).toEqual({
      key: "2026-12",
      startsAt: new Date("2026-12-01T00:00:00.000Z"),
      endsAt: new Date("2027-01-01T00:00:00.000Z"),
    });
  });

  it("scopes monthly grant idempotency to the user and UTC period", () => {
    expect(getFreeMonthlyGrantIdempotencyKey("user-1", "2026-07")).toBe("free:user-1:2026-07");
  });
});
