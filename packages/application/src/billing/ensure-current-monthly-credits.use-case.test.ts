import { describe, expect, it } from "vitest";
import type {
  CreditRepository,
  PersistenceTransaction,
  PersistenceUnitOfWork,
} from "@careerden/domain";
import { InMemoryCreditRepository } from "@careerden/infrastructure";
import { EnsureCurrentMonthlyCreditsUseCase } from "./ensure-current-monthly-credits.use-case.js";

describe("EnsureCurrentMonthlyCreditsUseCase", () => {
  it("creates the registration month's 10-credit UTC allowance and ledger entry", async () => {
    const credits = new InMemoryCreditRepository();
    const useCase = new EnsureCurrentMonthlyCreditsUseCase(
      createUnitOfWork(credits),
      () => new Date("2026-07-24T14:30:00.000Z"),
    );

    await expect(useCase.execute("user-1")).resolves.toMatchObject({ created: true });

    expect(credits.listGrants("user-1")).toEqual([
      expect.objectContaining({
        userId: "user-1",
        sourceType: "free_monthly",
        idempotencyKey: "free:user-1:2026-07",
        amount: 10,
        validFrom: new Date("2026-07-01T00:00:00.000Z"),
        expiresAt: new Date("2026-08-01T00:00:00.000Z"),
        metadata: { period: "2026-07" },
      }),
    ]);
    expect(credits.listLedgerEntries("user-1")).toEqual([
      expect.objectContaining({
        entryType: "grant",
        delta: 10,
        idempotencyKey: "grant:free:user-1:2026-07",
      }),
    ]);
  });

  it("does not duplicate credits for repeated sessions in the same UTC month", async () => {
    const credits = new InMemoryCreditRepository();
    const useCase = new EnsureCurrentMonthlyCreditsUseCase(
      createUnitOfWork(credits),
      () => new Date("2026-07-24T14:30:00.000Z"),
    );

    await expect(useCase.execute("user-1")).resolves.toMatchObject({ created: true });
    await expect(useCase.execute("user-1")).resolves.toMatchObject({ created: false });

    expect(credits.listGrants("user-1")).toHaveLength(1);
    expect(credits.listLedgerEntries("user-1")).toHaveLength(1);
  });

  it("creates only the current allowance after a missed UTC month", async () => {
    const credits = new InMemoryCreditRepository();
    let now = new Date("2026-07-24T14:30:00.000Z");
    const useCase = new EnsureCurrentMonthlyCreditsUseCase(createUnitOfWork(credits), () => now);

    await useCase.execute("user-1");
    now = new Date("2026-10-10T08:00:00.000Z");
    await useCase.execute("user-1");

    expect(credits.listGrants("user-1").map((grant) => grant.idempotencyKey)).toEqual([
      "free:user-1:2026-07",
      "free:user-1:2026-10",
    ]);
  });
});

function createUnitOfWork(credits: CreditRepository): PersistenceUnitOfWork {
  return {
    execute: (work) => work({ credits } as PersistenceTransaction),
  };
}
