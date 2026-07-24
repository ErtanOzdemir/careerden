import { describe, expect, it } from "vitest";
import { creditBalanceSchema } from "./credit-balance.schema.js";

describe("creditBalanceSchema", () => {
  it("accepts a consistent non-negative balance", () => {
    expect(
      creditBalanceSchema.parse({
        totalCredits: 10,
        availableCredits: 9,
        reservedCredits: 1,
      }),
    ).toEqual({
      totalCredits: 10,
      availableCredits: 9,
      reservedCredits: 1,
    });
  });

  it("rejects inconsistent balances", () => {
    expect(
      creditBalanceSchema.safeParse({
        totalCredits: 10,
        availableCredits: 8,
        reservedCredits: 1,
      }).success,
    ).toBe(false);
  });

  it("rejects negative and fractional values", () => {
    expect(
      creditBalanceSchema.safeParse({
        totalCredits: -1,
        availableCredits: -1,
        reservedCredits: 0,
      }).success,
    ).toBe(false);
    expect(
      creditBalanceSchema.safeParse({
        totalCredits: 1.5,
        availableCredits: 1.5,
        reservedCredits: 0,
      }).success,
    ).toBe(false);
  });
});
