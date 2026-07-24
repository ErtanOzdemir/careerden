import { describe, expect, it } from "vitest";
import type {
  CreditRepository,
  PersistenceTransaction,
  PersistenceUnitOfWork,
} from "@careerden/domain";
import { InMemoryCreditRepository } from "@careerden/infrastructure";
import { GetCreditBalanceUseCase } from "./get-credit-balance.use-case.js";

describe("GetCreditBalanceUseCase", () => {
  it("provisions and returns the authenticated user's current monthly balance", async () => {
    const credits = new InMemoryCreditRepository();
    const useCase = new GetCreditBalanceUseCase(
      createUnitOfWork(credits),
      () => new Date("2026-07-24T14:30:00.000Z"),
    );

    await expect(useCase.execute("user-1")).resolves.toEqual({
      totalCredits: 10,
      availableCredits: 10,
      reservedCredits: 0,
    });
  });

  it("expires the prior allowance and exposes only the new UTC month's credits", async () => {
    const credits = new InMemoryCreditRepository();
    let now = new Date("2026-07-31T23:59:59.999Z");
    const useCase = new GetCreditBalanceUseCase(createUnitOfWork(credits), () => now);

    await expect(useCase.execute("user-1")).resolves.toMatchObject({ availableCredits: 10 });
    now = new Date("2026-08-01T00:00:00.000Z");
    await expect(useCase.execute("user-1")).resolves.toEqual({
      totalCredits: 10,
      availableCredits: 10,
      reservedCredits: 0,
    });
    expect(credits.listGrants("user-1")).toHaveLength(2);
  });
});

function createUnitOfWork(credits: CreditRepository): PersistenceUnitOfWork {
  return {
    execute: (work) => work({ credits } as PersistenceTransaction),
  };
}
