import { describe, expect, it } from "vitest";
import { InMemoryCreditRepository } from "./in-memory-credit.repository.js";

describe("InMemoryCreditRepository", () => {
  it("keeps grants idempotent and calculates only currently valid balances", async () => {
    const repository = new InMemoryCreditRepository();
    const input = {
      userId: "user-1",
      sourceType: "free_monthly" as const,
      idempotencyKey: "free:user-1:2026-07",
      amount: 10,
      validFrom: new Date("2026-07-01T00:00:00.000Z"),
      expiresAt: new Date("2026-08-01T00:00:00.000Z"),
      createdAt: new Date("2026-07-24T14:30:00.000Z"),
    };

    await expect(repository.ensureGrant(input)).resolves.toMatchObject({ created: true });
    await expect(repository.ensureGrant(input)).resolves.toMatchObject({ created: false });
    await expect(
      repository.getBalance("user-1", new Date("2026-07-31T23:59:59.999Z")),
    ).resolves.toEqual({
      totalCredits: 10,
      availableCredits: 10,
      reservedCredits: 0,
    });
    await expect(
      repository.getBalance("user-1", new Date("2026-08-01T00:00:00.000Z")),
    ).resolves.toEqual({
      totalCredits: 0,
      availableCredits: 0,
      reservedCredits: 0,
    });
    expect(repository.listGrants()).toHaveLength(1);
    expect(repository.listLedgerEntries()).toHaveLength(1);
  });
});
